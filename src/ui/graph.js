import { $, bus, tip, hideTip, card, hideCard, slotHex, harnessName, ago, score, NODE_GREY, MINT, WHITE, MUTED, SUBTLE } from './shared.js';

// The graph view. docs/UI-BRIEF.md 4.1 (Graph) and 5 (motion rules).
// d3-force with a pull toward each community's seat so communities read as
// islands, a collide radius from node size, and a weak centre. Physics runs
// once off screen on load, then stops; a live update pins old nodes and lets
// only the new one move. The five-step reveal swaps between a recorded-order
// arc layout and the settled force layout; colour arrives last.

const STEPS = ['sessions', 'distance', 'communities', 'shapes', 'arrival'];
const FONT = 'Geist Mono, monospace';

export function mountGraph(svgEl) {
  const svg = d3.select(svgEl);
  const root = svg.append('g');
  const shapeHullG = root.append('g'), hullG = root.append('g'), edgeG = root.append('g'), hitG = root.append('g');
  const nodeG = root.append('g'), ringG = root.append('g'), ghostG = root.append('g'), pulseG = root.append('g');
  const labelG = root.append('g'), hullLabelG = root.append('g');

  let nodes = [], links = [], byId = new Map(), sim = null, hidden = new Set();
  let GD = null, slots = new Map(), stats = { harnesses: {} };
  let selected = null, hovered = null, newest = null;
  let step = 4, W = 800, H = 600, seatOf = new Map();
  let ghost = null, savedTransform = null, arrivalDim = null, lastArrival = null;
  const pending = new Map(); // new node id -> {x, y, t0}, handed off by stored()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = (ms) => reduced ? 240 : ms;
  const ST = (i, gap) => reduced ? 0 : i * gap;

  const zoom = d3.zoom().scaleExtent([.3, 4]).on('zoom', (ev) => root.attr('transform', ev.transform));
  svg.call(zoom);
  function size() { const r = svgEl.getBoundingClientRect(); W = r.width || 800; H = r.height || 600; }
  function cameraTo(x, y, k, dur = 500) { return svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * x, H / 2 - k * y).scale(k)); }
  function fit() {
    const ms = nodes.filter(m => m.n.kind === 'session');
    if (!ms.length) return;
    const x0 = d3.min(ms, m => m.x) - 40, x1 = d3.max(ms, m => m.x) + 40, y0 = d3.min(ms, m => m.y) - 40, y1 = d3.max(ms, m => m.y) + 40;
    const k = Math.min(1.6, .9 * Math.min(W / (x1 - x0), H / (y1 - y0)));
    cameraTo((x0 + x1) / 2, (y0 + y1) / 2, k, 600);
  }
  function worldBottom() { const t = d3.zoomTransform(svg.node()); return (H - 30 - t.y) / t.k; }

  // Two rings: shapes on the outer ring ordered by palette slot (largest
  // first, grey last) so same-shape hulls stay contiguous; each shape's
  // communities on a small ring around its seat.
  function computeSeats(g) {
    const R1 = Math.min(W, H) * .34;
    const rank = (sid) => { const s = slots.get(sid); return s < 0 ? 999 + sid : s; };
    const order = g.shapes.slice().sort((a, b) => rank(a.id) - rank(b.id) || b.size - a.size || a.id - b.id);
    seatOf = new Map();
    order.forEach((sh, si) => {
      const a = si / order.length * Math.PI * 2 - Math.PI / 2;
      const sx = Math.cos(a) * R1, sy = Math.sin(a) * R1;
      const members = sh.clusters.map(c => g.clusters.find(x => x.id === c)).filter(Boolean).sort((a, b) => a.id - b.id);
      const R2 = members.length <= 1 ? 0 : 28 + 12 * members.reduce((k, c) => k + Math.sqrt(c.members.length), 0);
      members.forEach((c, ci) => { const b = ci / members.length * Math.PI * 2 + a; seatOf.set(c.id, { x: sx + Math.cos(b) * R2, y: sy + Math.sin(b) * R2 }); });
    });
  }
  function computeArc() {
    const arr = nodes.filter(m => m.n.kind === 'session').sort((a, b) => (a.n.created_at || '').localeCompare(b.n.created_at || ''));
    const n = arr.length, R = Math.min(W, H) * .55;
    arr.forEach((m, i) => { const t = n <= 1 ? .5 : i / (n - 1); const ang = Math.PI * (1 - t); m.tx = Math.cos(ang) * R; m.ty = -Math.abs(Math.sin(ang)) * R * .5 + R * .15; m.arcOrder = i; });
  }
  const midArcNode = () => { const a = nodes.filter(m => m.n.kind === 'session'); return a.length ? a.slice().sort((x, y) => x.tx - y.tx)[Math.floor(a.length / 2)] : null; };

  function visible(m) { return m && !hidden.has('shape:' + m.shape) && !hidden.has('cluster:' + m.cluster) && !(m.n.kind === 'file' && hidden.has('files')); }
  const stepAllows = (key) => STEPS.indexOf(key) <= step;
  function hullPath(ms, pad) {
    const pts = ms.flatMap(m => [[m.x - m.r - pad, m.y - m.r - pad], [m.x + m.r + pad, m.y - m.r - pad], [m.x - m.r - pad, m.y + m.r + pad], [m.x + m.r + pad, m.y + m.r + pad]]);
    const h = pts.length >= 3 ? d3.polygonHull(pts) : pts;
    return h ? 'M' + h.map(p => p.join(',')).join('L') + 'Z' : '';
  }

  function hueOf(d) {
    if (!stepAllows('shapes')) return MUTED;
    const s = slots.get(d.shape);
    return (s === undefined || s < 0) ? NODE_GREY : slotHex(s);
  }
  function fillOf(d) {
    if (d.n.kind === 'file') return NODE_GREY;
    if (d.arrivedAt) { const dt = Date.now() - d.arrivedAt; if (dt < 8000) return MINT; if (dt < 8400) return d3.interpolateRgb(MINT, hueOf(d))((dt - 8000) / 400); }
    return hueOf(d);
  }
  function adjacentIds(m) {
    const s = new Set([m.id]);
    for (const l of links) { if (l.source === m) s.add(l.target.id); else if (l.target === m) s.add(l.source.id); }
    return s;
  }
  function nodeOpacity(d) {
    if (arrivalDim) return arrivalDim.has(d.id) ? 1 : .28;
    if (!stepAllows('sessions')) return 0;
    const focus = hovered || selected;
    if (!focus) return 1;
    return adjacentIds(focus).has(d.id) ? 1 : .28;
  }
  function edgeOpacity(l) {
    const focus = hovered || selected;
    const adj = focus && (l.source === focus || l.target === focus);
    if (l.kind === 'wrote') return adj ? .5 : .08;
    const base = .06 + .3 * l.w * l.w;
    const b = l.source.cluster !== l.target.cluster ? base * .5 : base;
    return focus ? (adj ? .5 : .05) : b;
  }
  const clusterName = (id) => (GD.clusters.find(c => c.id === id) || {}).name || 'session';
  const shapeName = (id) => (GD.shapes.find(s => s.id === id) || {}).name || '';
  const writersOf = (d) => links.filter(l => l.kind === 'wrote' && (l.source === d || l.target === d)).length;

  function render() {
    const showEdges = stepAllows('distance'), showHull = stepAllows('communities');

    const sim1 = edgeG.selectAll('line').data(showEdges ? links.filter(l => visible(l.source) && visible(l.target)) : [], l => l.source.id + '|' + l.target.id);
    sim1.exit().remove();
    sim1.enter().append('line').merge(sim1)
      .classed('sim', l => l.kind === 'similar')
      .attr('x1', l => l.source.x).attr('y1', l => l.source.y).attr('x2', l => l.target.x).attr('y2', l => l.target.y)
      .attr('stroke', WHITE).attr('stroke-dasharray', l => l.kind === 'wrote' ? '2 3' : null)
      .attr('stroke-width', l => { const f = hovered || selected; return (f && (l.source === f || l.target === f)) ? 1.2 : 1; })
      .attr('opacity', l => edgeOpacity(l));

    const hit = hitG.selectAll('line').data(showEdges ? links.filter(l => visible(l.source) && visible(l.target)) : [], l => l.source.id + '|' + l.target.id);
    hit.exit().remove();
    hit.enter().append('line').attr('stroke', 'transparent').attr('stroke-width', 8)
      .on('mouseenter', (ev, l) => tip(ev, l.kind === 'wrote' ? `${l.source.n.task || l.source.n.label} wrote ${l.target.n.label}` : 'ncd ' + score(1 - l.w)))
      .on('mousemove', (ev, l) => tip(ev, l.kind === 'wrote' ? `${l.source.n.task || l.source.n.label} wrote ${l.target.n.label}` : 'ncd ' + score(1 - l.w)))
      .on('mouseleave', hideTip)
      .merge(hit).attr('x1', l => l.source.x).attr('y1', l => l.source.y).attr('x2', l => l.target.x).attr('y2', l => l.target.y);

    renderHulls(showHull);

    const vis = nodeG.selectAll('circle.vis').data(nodes, d => d.id);
    vis.exit().remove();
    vis.enter().append('circle').attr('class', 'vis').style('pointer-events', 'none').merge(vis)
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
      .attr('fill', d => fillOf(d))
      .attr('fill-opacity', d => (d.n.harness && d.n.harness !== 'claude') ? .18 : 1)
      .attr('stroke', d => (d.n.harness && d.n.harness !== 'claude') ? fillOf(d) : 'none')
      .attr('stroke-width', d => (d.n.harness && d.n.harness !== 'claude') ? 1.6 : 0)
      .attr('opacity', d => nodeOpacity(d));

    const dot3 = nodeG.selectAll('circle.dot3').data(nodes.filter(d => d.n.harness && d.n.harness !== 'claude' && d.n.harness !== 'devin'), d => d.id);
    dot3.exit().remove();
    dot3.enter().append('circle').attr('class', 'dot3').style('pointer-events', 'none').attr('r', 2).merge(dot3)
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('fill', d => fillOf(d)).attr('opacity', d => nodeOpacity(d));

    const hitN = nodeG.selectAll('circle.hit').data(nodes, d => d.id);
    hitN.exit().remove();
    const hitEnter = hitN.enter().append('circle').attr('class', 'hit').attr('fill', 'transparent').style('cursor', 'pointer')
      .on('mouseenter', (ev, d) => { hovered = d; nodeCard(ev, d); render(); })
      .on('mousemove', (ev, d) => nodeCard(ev, d))
      .on('mouseleave', () => { hovered = null; hideCard(); render(); })
      .on('click', (ev, d) => { selectNode(d); ev.stopPropagation(); })
      .call(d3.drag().on('start', (ev, d) => { d.fx = null; d.fy = null; }).on('drag', (ev, d) => { d.x = ev.x; d.y = ev.y; render(); }));
    hitEnter.merge(hitN).attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => Math.max(d.r + 4, 12));

    const rings = [];
    if (hovered && visible(hovered)) rings.push({ key: 'h', m: hovered, r: hovered.r + 3, op: 1 });
    if (selected && visible(selected)) rings.push({ key: 's', m: selected, r: selected.r + 7, op: .6 });
    const rg = ringG.selectAll('circle').data(rings, d => d.key);
    rg.exit().remove();
    rg.enter().append('circle').attr('fill', 'none').attr('stroke', WHITE).attr('stroke-width', 1).style('pointer-events', 'none').merge(rg)
      .attr('cx', d => d.m.x).attr('cy', d => d.m.y).attr('r', d => d.r).attr('stroke-opacity', d => d.op);

    const labelled = [selected, newest].filter((m, i, a) => m && m.n.kind === 'session' && visible(m) && a.findIndex(x => x && x.id === m.id) === i);
    const lb = labelG.selectAll('text.node').data(labelled, d => d.id);
    lb.exit().remove();
    lb.enter().append('text').attr('class', 'node').attr('font-family', FONT).attr('font-size', 10).attr('fill', MUTED).style('pointer-events', 'none').merge(lb)
      .attr('x', d => d.x + d.r + 4).attr('y', d => d.y + 3).text(d => d.n.task || d.n.label);

    ghostG.selectAll('circle.node').attr('cx', d => d.x).attr('cy', d => d.y);
    ghostG.selectAll('line.edge').attr('x1', d => ghost ? ghost.x : 0).attr('y1', d => ghost ? ghost.y : 0).attr('x2', d => d.x).attr('y2', d => d.y);
  }

  function renderHulls(showHull) {
    const shapeColored = stepAllows('shapes');
    const groups = [...d3.group(nodes.filter(m => m.n.kind === 'session' && m.cluster !== undefined && visible(m)), m => m.cluster).entries()].sort((a, b) => b[1].length - a[1].length);
    const entries = showHull ? groups : [];
    const hulls = hullG.selectAll('path.c').data(entries, d => d[0]);
    hulls.exit().transition().duration(D(300)).attr('opacity', 0).remove();
    hulls.enter().append('path').attr('class', 'c').attr('opacity', 0).merge(hulls)
      .attr('d', ([, ms]) => hullPath(ms, 10)).attr('stroke-linejoin', 'round')
      .attr('fill', ([, ms]) => shapeColored ? slotHex(slots.get(ms[0].shape)) : MUTED)
      .attr('stroke', ([, ms]) => shapeColored ? slotHex(slots.get(ms[0].shape)) : MUTED)
      .attr('stroke-width', 1).attr('fill-opacity', .07).attr('stroke-opacity', .35)
      .transition().duration(400).attr('opacity', 1);

    const lbl = hullLabelG.selectAll('g.c').data(entries, d => d[0]);
    lbl.exit().remove();
    const lblEnter = lbl.enter().append('g').attr('class', 'c').style('pointer-events', 'none');
    lblEnter.append('text').attr('class', 'n1').attr('text-anchor', 'middle').attr('font-family', FONT).attr('font-size', 11).attr('fill', MUTED);
    lblEnter.append('text').attr('class', 'n2').attr('text-anchor', 'middle').attr('font-family', FONT).attr('font-size', 10).attr('fill', SUBTLE);
    const lblAll = lblEnter.merge(lbl);
    lblAll.select('text.n1').attr('x', ([, ms]) => d3.mean(ms, m => m.x)).attr('y', ([, ms]) => d3.min(ms, m => m.y - m.r - 10) - 20).text(([id]) => clusterName(id));
    lblAll.select('text.n2').attr('x', ([, ms]) => d3.mean(ms, m => m.x)).attr('y', ([, ms]) => d3.min(ms, m => m.y - m.r - 10) - 8).text(([, ms]) => `${ms.length} sessions`);

    const shapeGroups = [...d3.group(nodes.filter(m => m.n.kind === 'session' && m.shape !== undefined && visible(m)), m => m.shape).entries()].filter(([sid]) => slots.get(sid) >= 0);
    const shapeEntries = showHull ? shapeGroups : [];
    const sh = shapeHullG.selectAll('path').data(shapeEntries, d => d[0]);
    sh.exit().remove();
    sh.enter().append('path').merge(sh)
      .attr('d', ([, ms]) => hullPath(ms, 18)).attr('fill', 'none').attr('stroke-linejoin', 'round')
      .attr('stroke', ([sid]) => shapeColored ? slotHex(slots.get(sid)) : MUTED)
      .attr('stroke-width', 40).attr('stroke-opacity', .08);
    const shLbl = hullLabelG.selectAll('text.s').data(shapeEntries, d => d[0]);
    shLbl.exit().remove();
    shLbl.enter().append('text').attr('class', 's').attr('text-anchor', 'middle').attr('font-family', FONT).attr('font-size', 11).attr('fill', MUTED).style('pointer-events', 'none').merge(shLbl)
      .attr('x', ([, ms]) => d3.mean(ms, m => m.x)).attr('y', ([, ms]) => d3.min(ms, m => m.y - m.r - 18) - 30).text(([sid]) => shapeName(sid));
  }

  function nodeCard(ev, d) {
    const n = d.n;
    if (n.kind === 'file') { card(ev, n.label, `changed by ${writersOf(d)} sessions`); return; }
    card(ev, `${n.task || 'session'}, ${harnessName(n.harness)}`, `${n.calls || 0} calls, ${n.discovery || 0} before first edit, ${ago(n.created_at)}`);
  }

  function selectNode(m) { selected = m; render(); bus.emit('select', m || null); }
  function select(id) { selectNode(id == null ? null : byId.get(id) || null); }
  function focus(id) { const m = byId.get(id); if (!m) return; selectNode(m); cameraTo(m.x, m.y, 1.4, 500); }
  function escape() { if (selected) { selectNode(null); return; } fit(); }
  function filter(h) { hidden = h; render(); }
  svg.on('click', () => selectNode(null));

  function pulse(m, op, delay) {
    const c = pulseG.append('circle').attr('cx', m.x).attr('cy', m.y).attr('r', m.r + 2).attr('fill', 'none').attr('stroke', MINT).attr('stroke-width', 1.5).attr('stroke-opacity', op);
    c.transition().delay(D(delay)).duration(D(1600)).ease(d3.easeCubicOut).attr('r', m.r + 40).attr('stroke-opacity', 0).on('end', function () { this.remove(); });
  }
  function drawGhost(lane, x, y, sources) {
    ghost = { x, y, lane };
    const g = ghostG.selectAll('circle.node').data([ghost]);
    g.enter().append('circle').attr('class', 'node').attr('r', 7).attr('fill', 'none').attr('stroke', MINT).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3').merge(g).attr('cx', x).attr('cy', y);
    const t = ghostG.selectAll('text.node').data([ghost]);
    t.enter().append('text').attr('class', 'node').attr('text-anchor', 'middle').attr('font-family', FONT).attr('font-size', 10).attr('fill', MUTED).merge(t).attr('x', x).attr('y', y + 21).text(lane);
    const e = ghostG.selectAll('line.edge').data(sources);
    e.enter().append('line').attr('class', 'edge').attr('stroke', MINT).attr('stroke-width', 1).attr('stroke-dasharray', '3 3').attr('opacity', .6).merge(e)
      .attr('x1', x).attr('y1', y).attr('x2', d => d.x).attr('y2', d => d.y);
    e.exit().remove();
  }
  function clearGhost() { ghostG.selectAll('*').remove(); ghost = null; }

  // The receipt sentence, section 4.5: built from the handoff record, never
  // typed. The receiving harness is not known this early (it is read from
  // the receiver's first tool event, which has not landed yet), so the
  // sentence names the session instead of a harness there.
  function receiptSentence(ev) {
    const rec = ev.record;
    if (!rec || !rec.from || !rec.from.length) return `A new session is handed a procedure from ${(ev.ids || []).length} earlier sessions.`;
    const src = rec.from[0], n = rec.n || rec.from.length, agree = rec.agree || [];
    const allN = agree.filter(a => a.n === n).map(a => a.file);
    const top = agree.slice().sort((a, b) => b.n - a.n)[0];
    const changed = allN.length ? `All ${n} sessions like it changed ${allN.join(', ')}.` : top ? `${top.n} of ${n} sessions like it changed ${top.file}.` : '';
    return `This session was handed a procedure ${harnessName(src.harness)} recorded ${ago(src.created_at)}. ${changed}`.trim();
  }

  function arrival(ev) {
    lastArrival = ev;
    const sources = (ev.ids || []).map(id => byId.get(id)).filter(Boolean);
    if (!sources.length) return;
    sources.forEach((m, i) => pulse(m, i === 0 ? 1 : .5, i * 80));
    arrivalDim = new Set(sources.map(s => s.id));
    render();
    const gx0 = d3.mean(sources, m => m.x), gy0 = d3.mean(sources, m => m.y), len = Math.hypot(gx0, gy0) || 1;
    const gx = gx0 - gx0 / len * 28, gy = gy0 - gy0 / len * 28;
    drawGhost(ev.lane, gx, gy, sources);
    const cap = $('#caption'); cap.textContent = receiptSentence(ev); cap.classList.add('on');
    savedTransform = d3.zoomTransform(svg.node());
    const xs = [...sources.map(m => m.x), gx], ys = [...sources.map(m => m.y), gy];
    cameraTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 1.4, D(600));
  }

  function stored(ev) {
    if (ghost) pending.set(ev.id, { x: ghost.x, y: ghost.y, t0: Date.now() });
    clearGhost();
    arrivalDim = null;
    if (savedTransform) { svg.transition().duration(D(600)).call(zoom.transform, savedTransform); savedTransform = null; }
    render();
    nodeG.selectAll('.vis,.hit,.dot3').transition().duration(D(400)).attr('opacity', d => nodeOpacity(d));
  }

  function runTicks(n) {
    return new Promise((resolve) => {
      let i = 0;
      const t = d3.interval(() => { sim.tick(); render(); i++; if (i >= n) { t.stop(); resolve(); } }, 16);
    });
  }

  function setData(g, slotsMap, opts = {}) {
    size();
    GD = g; slots = slotsMap; stats = g.stats;
    const live = !!opts.live, old = byId, firstLoad = !old.size;
    byId = new Map();
    const writers = new Map();
    for (const e of g.edges) if (e.kind === 'wrote') writers.set(e.b, (writers.get(e.b) || 0) + 1);
    const clusterOf = new Map(); for (const c of g.clusters) for (const m of c.members) clusterOf.set(m, c.id);
    const shapeOf = new Map(); for (const s of g.shapes) for (const c of s.clusters) shapeOf.set(c, s.id);
    computeSeats(g);
    const wb = worldBottom(), newIds = [];
    nodes = g.nodes.map((n) => {
      const o = old.get(n.id);
      const cluster = clusterOf.get(n.id), shape = cluster === undefined ? undefined : shapeOf.get(cluster);
      const r = n.kind === 'file' ? 3 + Math.min(writers.get(n.id) || 0, 8) * 1.1 : 7 + Math.min(Math.sqrt(n.discovery || 0) * 1.6, 9);
      if (o) { Object.assign(o, { n, r, cluster, shape }); byId.set(n.id, o); return o; }
      const p = pending.get(n.id);
      const seat = cluster !== undefined ? seatOf.get(cluster) : null;
      const m = { id: n.id, n, r, cluster, shape, x: p ? p.x : (seat ? seat.x : (Math.random() - .5) * 40), y: p ? p.y : (live ? wb : (Math.random() - .5) * 40), arrivedAt: p ? p.t0 : 0 };
      if (p) { newest = m; pending.delete(n.id); setTimeout(render, 8050); setTimeout(render, 8450); }
      if (live && !firstLoad) newIds.push(n.id);
      byId.set(n.id, m); return m;
    });
    links = g.edges.map(e => ({ source: byId.get(e.a), target: byId.get(e.b), w: e.w, kind: e.kind })).filter(l => l.source && l.target);
    computeArc();
    if (sim) sim.stop();
    sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(l => l.kind === 'wrote' ? 34 : 40 + (1 - l.w) * 120).strength(l => l.kind === 'wrote' ? .25 : .5 * l.w))
      .force('charge', d3.forceManyBody().strength(d => d.n.kind === 'file' ? -40 : -90).distanceMax(260))
      .force('collide', d3.forceCollide(d => d.r + 3).iterations(2))
      .force('x', d3.forceX(d => (d.cluster !== undefined && seatOf.get(d.cluster)) ? seatOf.get(d.cluster).x : 0).strength(d => d.n.kind === 'file' ? .01 : .12))
      .force('y', d3.forceY(d => (d.cluster !== undefined && seatOf.get(d.cluster)) ? seatOf.get(d.cluster).y : 0).strength(d => d.n.kind === 'file' ? .01 : .12))
      .force('center', d3.forceCenter(0, 0).strength(.02))
      .stop();
    if (!live) {
      sim.alpha(1);
      for (let i = 0; i < 300; i++) sim.tick();
      nodes.forEach(m => { m.sx = m.x; m.sy = m.y; });
      computeArc();
      if (firstLoad) fit();
      render();
    } else {
      for (const m of nodes) if (!newIds.includes(m.id)) { m.fx = m.x; m.fy = m.y; }
      sim.alpha(1);
      render();
      const finish = () => { for (const m of nodes) { m.fx = null; m.fy = null; m.sx = m.x; m.sy = m.y; } computeArc(); render(); };
      if (reduced) { for (let i = 0; i < 60; i++) sim.tick(); finish(); } else runTicks(60).then(finish);
    }
    bus.emit('graph:ready', { nodes, links });
  }

  // The five-step reveal, section 4.1. Each beat assumes the previous beat's
  // end state and animates its own delta; jumping to a beat instantly
  // replays the prior beats' end states with no animation first.
  function captionFor(i) {
    const names = Object.entries(stats.harnesses || {}).map(([k, n]) => `${harnessName(k)} (${n})`).join(' and ');
    return [
      `${stats.sessions} agent sessions on this repository, recorded from ${names}, in the order they ran.`,
      `Each session keeps its four nearest neighbours by compression distance. Two traces that gzip well together are close. No model.`,
      `Groups merge while their mean distance stays under .50: ${stats.clusters} communities. Within a group the mean distance is ${score(stats.mean_ncd_within)}, between groups ${score(stats.mean_ncd_between)}.`,
      `A second cut at .62 joins communities whose centres are close: ${stats.shapes} shapes. Flag, endpoint, bugfix. Nothing in the clustering read a task name.`,
      `A new session arrives. Its prompt is scored against every stored one and the three closest are handed to it before its first tool call.`,
    ][i];
  }

  async function beatSessions(animate) {
    step = 0;
    const sessions = nodes.filter(m => m.n.kind === 'session');
    for (const m of sessions) { m.x = m.tx; m.y = m.ty; }
    render();
    if (!animate) return;
    const stagger = reduced ? 0 : Math.min(80, 8000 / Math.max(1, sessions.length));
    const sel = nodeG.selectAll('.vis,.hit').filter(d => d.n.kind === 'session');
    sel.attr('opacity', 0);
    await sel.transition().delay(d => ST(d.arcOrder, stagger)).duration(D(300)).attr('opacity', d => nodeOpacity(d)).end().catch(() => {});
  }

  async function beatDistance(animate) {
    step = 1;
    for (const m of nodes) if (m.n.kind === 'session') { m.x = m.tx; m.y = m.ty; }
    render();
    if (animate) {
      const mid = midArcNode();
      if (mid) {
        const before = d3.zoomTransform(svg.node());
        await cameraTo(mid.x, mid.y, 1.6, D(400)).end().catch(() => {});
        const near = links.filter(l => l.kind === 'similar' && (l.source === mid || l.target === mid)).slice(0, 4);
        const g = edgeG.append('g');
        near.forEach((l, i) => {
          const len = Math.hypot(l.target.x - l.source.x, l.target.y - l.source.y) || 1;
          g.append('line').attr('x1', l.source.x).attr('y1', l.source.y).attr('x2', l.target.x).attr('y2', l.target.y)
            .attr('stroke', WHITE).attr('stroke-width', 1.2).attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
            .transition().delay(ST(i, 250)).duration(D(250)).attr('stroke-dashoffset', 0);
          g.append('text').attr('x', (l.source.x + l.target.x) / 2).attr('y', (l.source.y + l.target.y) / 2 - 4).attr('text-anchor', 'middle')
            .attr('font-family', FONT).attr('font-size', 10).attr('fill', MUTED).attr('opacity', 0).text(score(1 - l.w))
            .transition().delay(ST(i, 250) + D(150)).duration(D(150)).attr('opacity', 1);
        });
        await new Promise(r => setTimeout(r, D(2000)));
        await g.transition().duration(D(300)).attr('opacity', 0).end().catch(() => {});
        g.remove();
        await svg.transition().duration(D(400)).call(zoom.transform, before).end().catch(() => {});
      }
      render();
      const simSel = edgeG.selectAll('line.sim');
      const order = simSel.nodes().map(n => n.__data__).sort((a, b) => ((a.source.x + a.target.x) - (b.source.x + b.target.x)));
      const rank = new Map(order.map((l, i) => [l, i]));
      simSel.attr('opacity', 0).transition().delay(l => ST(rank.get(l) || 0, reduced ? 0 : 600 / Math.max(1, order.length))).duration(D(300)).attr('opacity', l => edgeOpacity(l));
      const from = new Map(nodes.map(m => [m.id, { x: m.x, y: m.y }]));
      await new Promise((resolve) => {
        const dur = D(2500);
        const t = d3.timer((elapsed) => {
          const p = Math.min(1, elapsed / dur);
          for (const m of nodes) { const f = from.get(m.id); if (!f) continue; m.x = f.x + (m.sx - f.x) * p; m.y = f.y + (m.sy - f.y) * p; }
          render();
          if (p >= 1) { t.stop(); resolve(); }
        });
      });
    } else { for (const m of nodes) { m.x = m.sx; m.y = m.sy; } render(); }
  }

  async function beatCommunities(animate) {
    step = 2;
    for (const m of nodes) if (m.n.kind === 'session') { m.x = m.sx; m.y = m.sy; }
    render();
    if (!animate) return;
    const groups = [...d3.group(nodes.filter(m => m.n.kind === 'session' && m.cluster !== undefined && visible(m)), m => m.cluster).entries()].sort((a, b) => b[1].length - a[1].length);
    const paths = hullG.selectAll('path.c');
    paths.attr('opacity', 0);
    await paths.transition().delay((d) => { const i = groups.findIndex(g => g[0] === d[0]); return ST(Math.max(i, 0), 150); }).duration(D(300)).attr('opacity', 1).end().catch(() => {});
  }

  async function beatShapes(animate) {
    render();
    if (!animate) { step = 3; render(); return; }
    const shapeIds = [...new Set(nodes.filter(m => m.n.kind === 'session' && m.shape !== undefined && slots.get(m.shape) >= 0).map(m => m.shape))].sort((a, b) => slots.get(a) - slots.get(b));
    for (let i = 0; i < shapeIds.length; i++) {
      const sid = shapeIds[i], hue = slotHex(slots.get(sid));
      await new Promise(r => setTimeout(r, i === 0 ? 0 : D(500)));
      shapeHullG.selectAll('path').filter(d => d[0] === sid).transition().duration(D(600)).attr('stroke', hue);
      hullG.selectAll('path.c').filter(d => d[1][0].shape === sid).transition().duration(D(600)).attr('fill', hue).attr('stroke', hue);
      await new Promise(r => setTimeout(r, D(200)));
      nodeG.selectAll('circle.vis').filter(d => d.shape === sid).transition().duration(D(200)).attr('fill', hue).attr('stroke', d => (d.n.harness && d.n.harness !== 'claude') ? hue : 'none');
    }
    step = 3; render();
  }

  function beatArrivalReplay() {
    step = 4;
    if (lastArrival) { arrival(lastArrival); return Promise.resolve(); }
    const sessions = nodes.filter(m => m.n.kind === 'session');
    if (!sessions.length) { render(); return Promise.resolve(); }
    const m = sessions.slice().sort((a, b) => (b.n.created_at || '').localeCompare(a.n.created_at || ''))[0];
    selectNode(m);
    return cameraTo(m.x, m.y, 1.4, D(600)).end().catch(() => {});
  }

  function runBeat(i, animate) { return [beatSessions, beatDistance, beatCommunities, beatShapes, beatArrivalReplay][i](animate); }
  let playToken = 0;
  async function goToStep(i) {
    const token = ++playToken;
    for (let s = 0; s < i; s++) { if (token !== playToken) return; await runBeat(s, false); }
    if (token !== playToken) return;
    const cap = $('#caption'); cap.textContent = captionFor(i); cap.classList.add('on');
    for (const el of stepsEl.children) el.classList.toggle('on', Number(el.dataset.i) === i);
    await runBeat(i, true);
  }
  async function play() {
    const token = ++playToken;
    for (let i = 0; i < STEPS.length; i++) {
      await goToStep(i);
      if (token !== playToken) return;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  const stepsEl = $('#steps');
  STEPS.forEach((k, i) => { const b = document.createElement('button'); b.className = 'step'; b.dataset.i = String(i); b.textContent = `${i + 1} ${k}`; b.onclick = () => goToStep(i); stepsEl.appendChild(b); });
  const pb = document.createElement('button'); pb.className = 'step'; pb.textContent = 'play'; pb.onclick = play; stepsEl.appendChild(pb);

  window.addEventListener('resize', () => { size(); render(); });

  return { setData, select, focus, escape, filter, arrival, stored, get links() { return links; } };
}

