import { $, bus, esc, glyph, harnessName, ago, MINUS } from './shared.js';

// docs/UI-BRIEF.md 4.6: every hand-off, newest first, who recorded what and
// who was handed it. The receipt in the lane is one hand-off as it happens;
// this view lists them after the fact so the crossing reads as a count and
// as a list, not only as one live moment.

export function mountHanded(el) {
  let stored = null; // total procedures stored, from /api/graph, for the lead's middle state
  let last = null;
  fetch('/api/graph').then(r => r.json()).then(g => { stored = g?.stats?.sessions ?? null; if (last) render(last.rows, last.ctx); }).catch(() => {});

  function render(rows, ctx) {
    last = { rows, ctx };
    const ps = rows.filter(r => r.pair);
    el.innerHTML = `<div class="lead">${esc(lead(rows))}</div>` +
      (rows.length
        ? basis(rows, ps) + crossing(rows) + list(rows)
        : `<div class="basis">No session has been handed anything yet. Run one with <code>HEADSTART_INJECT=full</code>.</div>`);
    wire();
  }

  function lead(rows) {
    if (rows.length) return `${rows.length} session${rows.length === 1 ? '' : 's'} got a head start.`;
    if (stored) return `${stored} procedure${stored === 1 ? '' : 's'} stored. None has been handed to a session yet.`;
    return 'Nothing stored yet.';
  }

  // Only paired sessions (a cold run of the same task exists) count.
  function basis(rows, ps) {
    if (!ps.length) return `<div class="basis">None of them has a cold run of the same task to compare with, so there is no figure to show.</div>`;
    const k = Math.round(ps.reduce((s, r) => s - r.pair.calls, 0) / ps.length);
    const j = Math.round(ps.reduce((s, r) => s - r.pair.discovery, 0) / ps.length);
    const cw = k >= 0 ? `${k} fewer tool calls` : `${Math.abs(k)} more tool calls`;
    const jw = j >= 0 ? `${j} fewer before the first edit` : `${Math.abs(j)} more before the first edit`;
    return `<div class="basis">Those sessions made ${cw} and ${jw} than the cold runs of the same task, over ${ps.length} pair${ps.length === 1 ? '' : 's'}.</div>`;
  }

  // The one line that states the cross-agent claim as a number.
  function crossing(rows) {
    const dirs = new Map();
    let x = 0;
    for (const r of rows) {
      const recv = r.receiver?.harness || 'unknown';
      const srcs = [...new Set((r.from || []).map(f => f.harness))].filter(h => h !== recv);
      if (!srcs.length) continue;
      x++;
      for (const h of srcs) dirs.set(recv + '|' + h, (dirs.get(recv + '|' + h) || 0) + 1);
    }
    if (!x) return '';
    const parts = [...dirs.entries()].map(([k, n]) => {
      const [recv, src] = k.split('|');
      return `${harnessName(recv)} was handed what ${harnessName(src)} recorded ${n} time${n === 1 ? '' : 's'}`;
    });
    return `<div class="basis">${x} of them from a session on another harness: ${parts.join(', ')}.</div>`;
  }

  function list(rows) {
    const rowsHtml = rows.slice(0, 12).map(rowHtml).join('');
    return `<div class="rows">${rowsHtml}<div class="note"><a class="link" data-measured="1">every pair, and what it saved</a></div></div>`;
  }

  function rowHtml(r) {
    const from = r.from || [];
    const shown = from.slice(0, 2).map(f => `<span class="link" data-focus="${esc(f.id)}">${esc(f.task_id || f.id)}</span> (${esc(harnessName(f.harness))})`).join(', ');
    const more = from.length > 2 ? ` and ${from.length - 2} more` : '';
    const figs = [];
    if (r.pair) {
      const c = -r.pair.calls, dd = -r.pair.discovery;
      if (c) figs.push(`<span class="${c >= 0 ? 'good' : 'bad'}">${c >= 0 ? MINUS + c : '+' + Math.abs(c)} calls</span>`);
      if (dd) figs.push(`<span class="${dd >= 0 ? 'good' : 'bad'}">${dd >= 0 ? MINUS + dd : '+' + Math.abs(dd)} before first edit</span>`);
    }
    const prompt = r.receiver?.prompt || '';
    const harness = r.receiver?.harness;
    return `<div class="row-h" data-session="${esc(r.session)}">` +
      `<div class="g">${harness ? glyph(harness) : ''}</div>` +
      `<div class="body"><div class="t" title="${esc(prompt)}">${esc(prompt)}</div><div class="h">handed ${shown}${more}</div></div>` +
      `<div class="fig">${figs.join('')}</div>` +
      `<div class="when">${esc(ago(r.at))}</div></div>`;
  }

  function wire() {
    for (const r of el.querySelectorAll('.row-h')) {
      r.onclick = (ev) => { if (ev.target.closest('[data-focus]')) return; bus.emit('select-session', r.dataset.session); };
    }
    for (const s of el.querySelectorAll('[data-focus]')) s.onclick = (ev) => { ev.stopPropagation(); bus.emit('focus', s.dataset.focus); };
    const m = el.querySelector('[data-measured]');
    if (m) m.onclick = () => { const t = document.querySelector('.tab[data-view="measured"]'); if (t) t.click(); };
  }

  return { render };
}
