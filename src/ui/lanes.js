import { $, bus, esc, glyph, harnessName, ago, MINUS, shortPath, toolClass, harnessOfTool } from './shared.js';

// docs/UI-BRIEF.md 4.5: the live lanes. Two Warp-style blocks fed by `trace`
// and `inject` events from src/live.ts. A lane is one session: a pinned
// head (harness glyph, status, counters), a ticker of rows, a stop row.
// The receipt sits under the prompt row, above the first tool row.

const agoNodes = []; // {el, iso}: refreshed on bus 'tick-minute' so an open screen never goes stale
bus.on('tick-minute', () => {
  for (let i = agoNodes.length - 1; i >= 0; i--) {
    const n = agoNodes[i];
    if (!n.el.isConnected) { agoNodes.splice(i, 1); continue; }
    n.el.textContent = ago(n.iso);
  }
});

export function mountLanes() {
  const lanes = {};
  const drawer = $('#drawer');
  // A lane is made the first time its name is seen: from the server's lane
  // list, or from the first event that names it. The two fixed lanes in
  // index.html are the pair demo; a plan makes as many as it has runs.
  function make(name) {
    const el = document.createElement('div');
    el.className = 'lane'; el.id = 'lane-' + name;
    el.innerHTML = '<div class="head"><b class="name"></b><span class="glyph-box"></span><span class="s">waiting</span><span class="c"><span class="calls"><b>0</b>calls</span><span class="disc"><b>0</b>before first edit</span><span class="secs"><b>0s</b></span><span class="pair"></span></span></div><div class="ticker"></div>';
    el.querySelector('.name').textContent = name;
    drawer.appendChild(el);
    drawer.classList.toggle('many', drawer.children.length > 2);
    return el;
  }
  function lane(name) {
    if (lanes[name]) return lanes[name];
    const el = $('#lane-' + name) || make(name);
    const L = {
      name, el, ticker: el.querySelector('.ticker'), glyphBox: el.querySelector('.glyph-box'),
      statusEl: el.querySelector('.s'), callsEl: el.querySelector('.calls b'), discEl: el.querySelector('.disc b'),
      secsEl: el.querySelector('.secs b'), pairEl: el.querySelector('.pair'),
      calls: 0, disc: 0, edited: false, ts0: 0, elapsed: '0s', stopped: false,
      session: null, prompt: null, harness: null, agree: [], verify: null, marked: false,
    };
    lanes[name] = L; return L;
  }

  // Insertion point for an inject-type row: right after the last prompt or
  // inject/receipt row, before any tool row (docs/UI-BRIEF.md 2.5, 4.5).
  function anchor(L) {
    const rows = L.ticker.querySelectorAll('.t.prompt, .t.inject, .receipt');
    return rows.length ? rows[rows.length - 1].nextSibling : L.ticker.firstChild;
  }
  function place(L, el, atAnchor) {
    L.ticker.insertBefore(el, atAnchor ? anchor(L) : null);
    L.ticker.scrollTop = L.ticker.scrollHeight;
  }
  function row(L, k, body, cls, atAnchor) {
    const d = document.createElement('div'); d.className = cls ? 't ' + cls : 't';
    d.innerHTML = `<span class="k">${esc(k)}</span><span class="p"></span>`;
    d.querySelector('.p').textContent = body;
    place(L, d, atAnchor);
    return d;
  }

  function reset(L, session) {
    L.ticker.innerHTML = '';
    L.calls = 0; L.disc = 0; L.edited = false; L.stopped = false;
    L.session = session; L.prompt = null; L.harness = null; L.agree = []; L.verify = null; L.marked = false;
    L.glyphBox.innerHTML = ''; L.statusEl.textContent = 'waiting';
    L.callsEl.textContent = '0'; L.discEl.textContent = '0'; L.secsEl.textContent = '0s'; L.elapsed = '0s';
    L.pairEl.innerHTML = '';
  }

  function onTrace(e) {
    const L = lane(e.lane);
    if (e.event === 'start') { reset(L, e.session); L.ts0 = e.ts || 0; L.statusEl.textContent = 'running'; return; }
    if (L.session !== e.session && e.event === 'prompt') reset(L, e.session);
    if (e.ts && L.ts0) { L.elapsed = Math.round((e.ts - L.ts0) / 1000) + 's'; L.secsEl.textContent = L.elapsed; }
    if (e.event === 'prompt') { L.prompt = e.prompt || ''; row(L, 'prompt', L.prompt, 'prompt'); return; }
    if (e.event === 'stop') {
      L.stopped = true; L.statusEl.textContent = 'done';
      row(L, 'stop', L.elapsed, 'stop');
      bus.emit('lane:done', { lane: L.name, calls: L.calls, discovery: L.disc, harness: L.harness });
      pairFigure();
      return;
    }
    if (e.event === 'tool') {
      const cls = toolClass(e.tool || '');
      if (!L.harness) { const h = harnessOfTool(e.tool || ''); if (h) { L.harness = h; L.glyphBox.innerHTML = glyph(h); } }
      if (cls === 'other') return;
      L.calls++;
      if (cls === 'write' && !L.edited) { L.edited = true; L.disc = L.calls - 1; }
      if (!L.edited) L.disc = L.calls;
      L.callsEl.textContent = L.calls; L.discEl.textContent = L.disc;
      const target = e.target || '';
      // Only `write` needs its own row style; the other class words are shown
      // as the key text but never as a CSS class, so they never collide with
      // an unrelated class of the same name (the rail's `.search` input box).
      const r = row(L, cls === 'execute' ? 'run' : cls, shortPath(target), cls === 'write' ? 'write' : '');
      if (!L.marked && target && ((L.verify && target === L.verify) || L.agree.some(f => target.endsWith(f)))) { r.classList.add('mark'); L.marked = true; }
    }
  }

  function onInject(e) {
    const L = lane(e.lane);
    L.el.classList.add('hs');
    if (e.kind === 'start') {
      row(L, 'handed', e.sessions ? `repo facts from ${e.sessions} earlier session${e.sessions === 1 ? '' : 's'}` : 'repo facts', 'inject', true);
      return;
    }
    if (e.record) receipt(L, e.record); else legacy(L, e);
  }

  // The four-line receipt, Concept A with the mint gutter bar from Concept C
  // (docs/UI-BRIEF.md 4.5). Never the match score or the character count.
  function receipt(L, rec) {
    L.agree = (rec.agree || []).map(a => a.file); L.verify = rec.verify || null; L.marked = false;
    const from0 = (rec.from || [])[0];
    const lines = [];
    lines.push(`<div class="l"><span class="k">handed</span><span>a procedure ${from0 ? esc(harnessName(from0.harness)) : ''} recorded ` +
      `<span class="ago">${from0 ? esc(ago(from0.created_at)) : ''}</span>` +
      (from0 ? ` (<span class="src" data-id="${esc(from0.id)}">${esc(from0.task_id || from0.id)}</span>)<span class="g">${glyph(from0.harness)}</span>` : '') +
      `</span></div>`);
    const agreeText = agreementLine(rec);
    if (agreeText) lines.push(`<div class="l s"><span class="k"></span><span>${esc(agreeText)}</span></div>`);
    if (rec.verify) lines.push(`<div class="l s"><span class="k"></span><span>verified with ${esc(rec.verify)}</span></div>`);
    lines.push(`<div class="l s"><span class="k"></span><span>${rec.discovery} calls to find this out last time</span></div>`);
    const el = document.createElement('div'); el.className = 'receipt'; el.innerHTML = lines.join('');
    const src = el.querySelector('.src'); if (src && from0) src.onclick = () => bus.emit('focus', from0.id);
    const agoEl = el.querySelector('.ago'); if (agoEl && from0) agoNodes.push({ el: agoEl, iso: from0.created_at });
    const g = el.querySelector('.g'); if (g) setTimeout(() => g.classList.add('done'), 1600);
    place(L, el, true);
  }
  // The same three shapes the injected text uses (src/inject.ts renderSimilar).
  function agreementLine(rec) {
    const agree = rec.agree || [];
    if (!agree.length) return '';
    const files = agree.map(a => a.file).join(', ');
    const n = Math.min(...agree.map(a => a.n));
    return n >= rec.n ? `all ${rec.n} session${rec.n === 1 ? '' : 's'} like this changed ${files}` : `${n} of ${rec.n} sessions like this changed ${files}`;
  }
  // Old logs without a JSON record: one line from the regex fields.
  function legacy(L, e) {
    const from = Object.entries(e.harnesses || {}).filter(([k]) => k !== 'unknown').map(([k, n]) => `${n} by ${harnessName(k)}`).join(', ');
    const matches = e.matches || 1;
    const body = `${matches} earlier match${matches === 1 ? '' : 'es'}${from ? ', ' + from : ''}` +
      (e.recorded ? `, recorded <span class="ago">${esc(ago(e.recorded))}</span>` : '');
    const el = document.createElement('div'); el.className = 'receipt';
    el.innerHTML = `<div class="l"><span class="k">handed</span><span>${body}</span></div>`;
    const agoEl = el.querySelector('.ago'); if (agoEl && e.recorded) agoNodes.push({ el: agoEl, iso: e.recorded });
    place(L, el, true);
  }

  // Both lanes stopped, same prompt: the pair figure goes into the
  // headstart lane's fourth counter (docs/UI-BRIEF.md 4.5).
  // The lane that just stopped is measured against the earliest stopped lane
  // with the same prompt that was handed nothing: its cold run.
  function pairFigure() {
    const done = Object.values(lanes).filter(l => l.stopped && l.prompt != null);
    const b = done[done.length - 1]; if (!b) return;
    const a = done.find(l => l !== b && l.prompt === b.prompt && !l.el.classList.contains('hs')) ?? (lanes.cold && lanes.cold.stopped && lanes.cold.prompt === b.prompt ? lanes.cold : null);
    if (!a || a === b) return;
    const d = a.calls - b.calls, dd = a.disc - b.disc, parts = [];
    if (d) parts.push(d > 0 ? `<span class="good">${MINUS}${d} calls</span>` : `<span class="bad">+${Math.abs(d)} calls</span>`);
    if (dd) parts.push(dd > 0 ? `<span class="good">${MINUS}${dd} before first edit</span>` : `<span class="bad">+${Math.abs(dd)} before first edit</span>`);
    b.pairEl.innerHTML = parts.length ? `${parts.join(', ')} <span class="vs">vs ${esc(a.name)}</span>` : '';
    bus.emit('pair:done', { cold: { calls: a.calls, discovery: a.disc, harness: a.harness }, headstart: { calls: b.calls, discovery: b.disc, harness: b.harness } });
  }

  function onStored() {} // the graph draws the arrival; lanes keep no state for it

  return { onTrace, onInject, onStored, lanes, lane };
}
