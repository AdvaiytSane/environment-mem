"""Read a bounded top-frame semantic snapshot without changing action indices."""

from __future__ import annotations

import asyncio
import json
from typing import Any


_SNAPSHOT = r"""() => {
  const normalize = text => (text || '').replace(/\s+/g, ' ').trim().slice(0, 512);
  const xpath = element => {
    const parts = [];
    while (element && element.nodeType === 1) {
      const tag = element.localName;
      const siblings = element.parentElement
        ? Array.from(element.parentElement.children).filter(item => item.localName === tag)
        : [element];
      parts.unshift(tag + (siblings.length > 1 ? '[' + (siblings.indexOf(element) + 1) + ']' : ''));
      element = element.parentElement;
    }
    return parts.join('/');
  };
  const roleOf = element => {
    if (element.getAttribute('role')) return element.getAttribute('role').split(' ')[0];
    const tag = element.localName;
    if (tag === 'a' && element.hasAttribute('href')) return 'link';
    if (tag === 'button') return 'button';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (type === 'checkbox' || type === 'radio') return type;
      return 'textbox';
    }
    if (tag === 'textarea' || element.isContentEditable) return 'textbox';
    if (tag === 'select') return 'combobox';
    return ({main:'main', nav:'navigation', header:'banner', footer:'contentinfo',
      form:'form', article:'article', section:'region', ul:'list', ol:'list',
      li:'listitem', table:'table', img:'img'})[tag] || 'generic';
  };
  const nameOf = element => {
    const textWithoutFields = target => {
      const copy = target.cloneNode(true);
      for (const field of copy.querySelectorAll('input,textarea,select,[contenteditable],[aria-hidden="true"],[hidden],script,style')) field.remove();
      return copy.textContent;
    };
    const labelled = element.getAttribute('aria-labelledby');
    if (labelled) {
      const text = labelled.split(/\s+/).map(id => {
        const target = document.getElementById(id);
        return target ? textWithoutFields(target) : '';
      }).join(' ');
      if (normalize(text)) return normalize(text);
    }
    const label = element.getAttribute('aria-label');
    if (label) return normalize(label);
    if (element.labels?.length) return normalize(Array.from(element.labels).map(textWithoutFields).join(' '));
    if (element.getAttribute('alt')) return normalize(element.getAttribute('alt'));
    // Never read input values, selected option text, or editable contents.
    if (['input','textarea','select'].includes(element.localName) || element.isContentEditable) return '';
    // Landmarks are structural; their entire descendant text is not a label.
    if (!['a','button'].includes(element.localName) && !/^h[1-6]$/.test(element.localName)) return '';
    return normalize(textWithoutFields(element));
  };
  const nodes = [];
  const candidates = document.querySelectorAll(
    'a[href],button,input:not([type="hidden"]),textarea,select,[role],[contenteditable="true"],' +
    'h1,h2,h3,h4,h5,h6,main,nav,header,footer,form,article,section,ul,ol,li,table,img[alt]'
  );
  for (const element of candidates) {
    if (nodes.length >= 600) break;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || element.getAttribute('aria-hidden') === 'true') continue;
    if (!element.getClientRects().length) continue;
    let depth = 0, parent = element.parentElement;
    while (parent) { depth++; parent = parent.parentElement; }
    const attrs = {};
    for (const key of ['type','aria-checked','aria-expanded','aria-disabled','aria-required']) {
      if (element.hasAttribute(key)) attrs[key] = element.getAttribute(key);
    }
    const node = {role:roleOf(element), name:nameOf(element), depth, tag:element.localName,
      xpath:xpath(element), attrs};
    if (element.localName === 'a' && element.hasAttribute('href')) node.href = element.href;
    nodes.push(node);
  }
  return {url:location.href, viewport_width:innerWidth, scroll_x:scrollX,
    scroll_y:scrollY, settled:document.readyState === 'complete', nodes};
}"""


def _top_frame(node: Any) -> bool:
    current = node
    while current is not None:
        if str(getattr(current, "node_name", "")).lower() == "iframe":
            return False
        if getattr(current, "shadow_root_type", None):
            return False
        node_type = getattr(current, "node_type", None)
        if getattr(node_type, "name", "") == "DOCUMENT_FRAGMENT_NODE":
            return False
        current = getattr(current, "parent_node", None)
    return True


async def collect_page_snapshot(browser_session: Any, *, timeout: float = 5) -> dict[str, Any]:
    """Collect metadata for BrowserWire.snapshot, retaining raw labels in memory.

    Does not call get_browser_state_summary or mutate Browser Use's selector map.
    Indices are attached only when the cached URL and top-frame XPath/tag/name
    match. They remain snapshot references, not replay locators. Shadow DOM and
    iframe descendants are intentionally outside this collector's scope.
    """
    async def collect() -> dict[str, Any]:
        page = await browser_session.get_current_page()
        if page is None:
            raise RuntimeError("Browser Use has no current page")
        selector_map = await browser_session.get_selector_map()
        raw = await page.evaluate(_SNAPSHOT)
        snapshot = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(snapshot, dict) or not isinstance(snapshot.get("nodes"), list):
            raise ValueError("browser snapshot must contain nodes")
        cached = getattr(browser_session, "_cached_browser_state_summary", None)
        cache_matches = getattr(cached, "url", None) == snapshot.get("url")
        index_by_path: dict[str, list[tuple[int, Any]]] = {}
        if cache_matches:
            for index, node in selector_map.items():
                if _top_frame(node):
                    index_by_path.setdefault(getattr(node, "xpath", ""), []).append((index, node))
        for node in snapshot["nodes"]:
            path = node.pop("xpath", "")
            matches = index_by_path.get(path, [])
            if len(matches) != 1:
                continue
            index, cached_node = matches[0]
            tag = str(getattr(cached_node, "node_name", "")).lower()
            ax = getattr(cached_node, "ax_node", None)
            cached_name = " ".join(str(getattr(ax, "name", "") or "").split())[:512]
            if tag != node.get("tag") or cached_name != node.get("name"):
                continue
            node.update(index=index, ref=str(index), ref_confidence="cached_xpath_tag_name")
        snapshot["collector_scope"] = "top_frame_light_dom"
        return snapshot

    return await asyncio.wait_for(collect(), timeout)
