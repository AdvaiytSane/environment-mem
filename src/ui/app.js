import { $, bus, esc, assignSlots, slotHex, glyph, harnessName, setHarnessMap, score, ago, NODE_GREY } from './shared.js';
import { mountGraph } from './graph.js';
import { mountMatrix } from './matrix.js';
import { mountTimeline } from './timeline.js';
import { mountLanes } from './lanes.js';
import { mountMeasured } from './measured.js';
import { mountHanded } from './handed.js';

// The wiring. Views are modules with one contract each:
//   graph.setData(g, slots) / .select(id) / .focus(id) / .arrival(inject) / .stored(ev) / .filter(hidden)
//   matrix.setData(g, slots) / .select(id)
//   timeline.setRuns(runs, meta) / .addLive(run)
//   measured.render(summary)
//   handed.render(rows, ctx)
//   lanes.onTrace(e) / .onInject(e) / .onStored(e)
// `slots` maps shape id to palette slot (-1 = grey), computed here once per graph.

const graph = mountGraph($('#graph'));
const matrix = mountMatrix($('#matrix'));
const timeline = mountTimeline($('#timeline'));
const lanes = mountLanes();
const measured = mountMeasured($('#measured'));
const handed = mountHanded($('#handed'));
let G = null, SLOTS = new Map(), SUMMARY = null, view = 'graph';
const hidden = new Set();
const queue = [];   // live events that land while another tab is on

for (const t of document.querySelectorAll('.tab')) t.onclick = () => showView(t.dataset.view);
function showView(v) {
  view = v;
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.view === v);
  for (const el of document.querySelectorAll('.view')) el.classList.toggle('on', el.dataset.view === v);
  bus.emit('view', v);
  if (v === 'graph') while (queue.length) queue.shift()();
  if (v === 'handed') fetch('/api/handoffs').then(r => r.json()).then(rows => handed.render(rows, { summary: SUMMARY }));
}

// legend: chips per shape, sub-chips per community, one `all`, one `files`
function legend(g) {
  const el = $('#legend');
  el.innerHTML = '<div class="label">Shapes</div>';
  const byC = new Map(g.clusters.map(c => [c.id, c]));
  const all = chip('all', 'all', g.nodes.filter(n => n.kind === 'session').length, null, false);
  all.classList.add('all');
  el.appendChild(all);
  const shapes = g.shapes.slice().sort((a, b) => b.size - a.size || a.id - b.id);
  for (const s of shapes) {
    const slot = SLOTS.get(s.id);
    el.appendChild(chip(`shape:${s.id}`, slot < 0 ? `other: ${s.name}` : s.name, s.size, slotHex(slot), false));
    for (const c of s.clusters.slice().sort((a, b) => byC.get(b).members.length - byC.get(a).members.length)) el.appendChild(chip(`cluster:${c}`, byC.get(c).name, byC.get(c).members.length, slotHex(slot), true));
  }
  el.appendChild(chip('files', 'files', g.nodes.filter(n => n.kind === 'file').length, null, false, true));
  syncAll();
}
function chip(key, label, n, color, sub, square) {
  const b = document.createElement('button');
  b.className = 'chip' + (sub ? ' sub' : ''); b.dataset.key = key;
  b.setAttribute('aria-pressed', hidden.has(key) ? 'false' : 'true');
  b.innerHTML = `<span class="dot${square ? ' sq' : ''}" style="${color ? 'background:' + color : ''}"></span><span>${esc(label)}</span><span class="n">${n}</span>`;
  b.onclick = () => {
    if (key === 'all') { const anyHidden = hidden.size > 0; hidden.clear(); if (!anyHidden) for (const c of $('#legend').querySelectorAll('.chip')) if (c.dataset.key !== 'all') hidden.add(c.dataset.key); }
    else if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
    for (const c of $('#legend').querySelectorAll('.chip')) { const k = c.dataset.key; const off = hidden.has(k); c.setAttribute('aria-pressed', off ? 'false' : 'true'); c.classList.toggle('off', off); }
    syncAll();
    graph.filter(new Set(hidden)); matrix.filter(new Set(hidden));
  };
  return b;
}
function syncAll() { const a = $('#legend .all'); if (!a) return; const total = $('#legend').querySelectorAll('.chip').length - 1; a.setAttribute('aria-pressed', hidden.size === 0 ? 'true' : hidden.size >= total ? 'false' : 'mixed'); }

// search
$('#search').addEventListener('input', ev => {
  const q = ev.target.value.trim().toLowerCase(); const out = $('#results'); out.innerHTML = '';
  if (!q || !G) return;
  const hits = G.nodes.filter(n => (n.label + ' ' + (n.task || '') + ' ' + harnessName(n.harness)).toLowerCase().includes(q)).slice(0, 12);
  for (const n of hits) {
    const d = document.createElement('div'); d.className = 'result';
    d.style.borderLeftColor = n.kind === 'file' ? NODE_GREY : slotHex(SLOTS.get(n.shape));
    d.innerHTML = n.kind === 'file' ? `<span class="t">${esc(n.label)}</span>` : `<span class="id">${esc(n.task || 'session')}</span>${n.harness ? glyph(n.harness) : ''}<span class="t">${esc(n.label)}</span>`;
    d.onclick = () => { showView('graph'); graph.focus(n.id); out.innerHTML = ''; ev.target.value = ''; };
    out.appendChild(d);
  }
});
$('#search').addEventListener('keydown', ev => { if (ev.key === 'Enter') { const f = $('#results .result'); if (f) f.click(); } });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && view === 'graph') graph.escape(); });

// inspector
bus.on('select', d => {
  const el = $('#inspector');
  if (!d) { el.innerHTML = '<div class="label">Selected</div><div class="empty">Click a node.</div>'; return; }
  const n = d.n, links = graph.links.filter(l => l.source === d || l.target === d);
  const cname = G.clusters.find(c => c.id === d.cluster);
  const sname = G.shapes.find(s => s.id === d.shape);
  const kv = n.kind === 'file'
    ? [['file', n.label], ['changed by', `${links.filter(l => l.kind === 'wrote').length} sessions`]]
    : [['task', n.task || 'session'], ['harness', `${glyph(n.harness)} ${esc(harnessName(n.harness))}`], ['recorded', `<span title="${esc(n.created_at || '')}">${ago(n.created_at)}</span>`], ['tool calls', n.calls], ['before first edit', n.discovery], ['verified', n.verified ? 'yes' : '—'], ['community', cname ? `${cname.name}, ${cname.members.length} sessions` : '—'], ['shape', sname ? sname.name : '—']];
  const nearest = links.filter(l => l.kind === 'similar').map(l => ({ o: l.source === d ? l.target : l.source, w: l.w })).sort((a, b) => b.w - a.w).slice(0, 8);
  el.innerHTML = `<div class="label">Selected</div><div class="title" title="${esc(n.label)}">${esc(n.label)}</div><div class="kv">${kv.map(([k, v]) => `<b>${k}</b><span>${typeof v === 'number' ? v : v}</span>`).join('')}</div>` +
    (n.files?.length ? `<div class="list"><div class="label">Files changed</div>${n.files.map(f => `<div class="nb"><span>${esc(f)}</span></div>`).join('')}</div>` : '') +
    (nearest.length ? `<div class="list"><div class="label">Nearest</div>${nearest.map(x => `<div class="nb" data-id="${esc(x.o.id)}" style="border-left-color:${slotHex(SLOTS.get(x.o.shape))}"><span>${esc(x.o.n.task || 'session')}</span>${x.o.n.harness ? glyph(x.o.n.harness) : ''}<span class="v">ncd ${score(1 - x.w)}</span></div>`).join('')}</div>` : '');
  for (const b of el.querySelectorAll('.nb[data-id]')) b.onclick = () => graph.focus(b.dataset.id);
});

// key and counts, bottom-left of the graph
function key(g) {
  const h = g.stats.harnesses || {};
  const rows = [];
  if (h.claude) rows.push(`<div class="row"><span class="dot" style="background:${NODE_GREY}"></span>claude code session</div>`);
  if (h.devin) rows.push(`<div class="row"><span class="ring"></span>devin cli session</div>`);
  rows.push(`<div class="row"><span class="dot sq"></span>file</div>`, `<div class="row">size  calls before the first edit</div>`, `<div class="row">file size  sessions that changed it</div>`);
  $('#gkey').innerHTML = rows.join('') + `<div class="counts">${g.stats.sessions} sessions, ${g.stats.files} files, ${g.stats.edges} edges, ${g.stats.clusters} communities, ${g.stats.shapes} shapes</div>`;
  $('#status-sessions').innerHTML = `<b>${g.stats.sessions}</b> sessions from <b>${Object.keys(h).length}</b> harness${Object.keys(h).length === 1 ? '' : 'es'}`;
  $('#mstats').innerHTML = `<span>mean ncd within a community <b>${score(g.stats.mean_ncd_within)}</b></span><span>between <b>${score(g.stats.mean_ncd_between)}</b></span><span>modularity <b>${score(g.stats.modularity)}</b></span><span><b>${g.stats.nn_task}</b> of ${g.stats.sessions} nearest neighbours share a task</span>`;
}

function setGraph(g, live) {
  G = g; SLOTS = assignSlots(g.shapes);
  graph.setData(g, SLOTS, { live }); matrix.setData(g, SLOTS); legend(g); key(g);
}

fetch('/api/graph').then(r => r.json()).then(g => setGraph(g, false));
fetch('/api/summary').then(r => r.json()).then(d => { SUMMARY = d; measured.render(d); timeline.setRuns((d && d.runs) || [], d); });

// live
const es = new EventSource('/api/live');
const liveEl = $('#status-live');
es.onopen = () => { liveEl.classList.remove('off'); liveEl.lastChild.textContent = 'live'; };
es.onerror = () => { liveEl.classList.add('off'); liveEl.lastChild.textContent = 'offline'; };
es.addEventListener('hello', e => { const d = JSON.parse(e.data); setHarnessMap(d.harness); for (const l of d.lanes || []) lanes.lane(l); });
es.addEventListener('lane', e => lanes.lane(JSON.parse(e.data).lane));
es.addEventListener('trace', e => lanes.onTrace(JSON.parse(e.data)));
es.addEventListener('inject', e => { const d = JSON.parse(e.data); lanes.onInject(d); const play = () => graph.arrival(d); if (view === 'graph') play(); else queue.push(play); });
es.addEventListener('stored', e => { const d = JSON.parse(e.data); lanes.onStored(d); timeline.addLive({ arm: 'full', calls: d.total, discovery: d.discovery }); const play = () => graph.stored(d); if (view === 'graph') play(); else queue.push(play); });
es.addEventListener('graph', e => { const g = JSON.parse(e.data); const play = () => setGraph(g, true); if (view === 'graph') play(); else queue.push(play); });
bus.on('lane:done', d => { if (d.lane === 'cold') timeline.addLive({ arm: 'cold', calls: d.calls, discovery: d.discovery }); });
bus.on('focus', id => { showView('graph'); graph.focus(id); });
bus.on('select-id', id => { graph.select(id); matrix.select(id); });
setInterval(() => bus.emit('tick-minute'), 60000);

// run panel
{
  const btn = $('#runbtn'), panel = $('#runpanel'), taskSel = $('#run-task'), free = $('#run-free'), note = $('#run-note');
  let tasks = [];
  fetch('/api/tasks').then(r => r.json()).then(d => {
    tasks = d.tasks || [];
    taskSel.innerHTML = tasks.map(t => `<option value="${esc(t.id)}">${esc(t.id)}  ${esc(t.prompt.slice(0, 70))}</option>`).join('');
    if (!d.hosted) note.textContent = 'local store only (no HEADSTART_API_URL)';
  });
  btn.onclick = () => { panel.hidden = !panel.hidden; };
  $('#run-mode').onchange = () => { $('#run-warm-row').style.display = $('#run-mode').value === 'demo' ? '' : 'none'; };
  $('#run-go').onclick = async () => {
    const task = free.value.trim() || taskSel.value;
    const body = { agent: $('#run-agent').value, task, mode: $('#run-mode').value, warmAgent: $('#run-warm').value || undefined };
    note.textContent = 'starting';
    const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    note.textContent = j.ok ? `started: headstart ${j.args.slice(0, 6).join(' ')}` : `failed: ${j.error}`;
  };
}
