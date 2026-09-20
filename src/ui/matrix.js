import { bus, tip, hideTip, slotHex, MUTED, SUBTLE, WHITE, harnessName, score } from './shared.js';

// The distance matrix. Sessions ordered by shape (largest first), then
// community, then recorded time: docs/UI-BRIEF.md 4.2, "one order everywhere".
// Cell value is ncd(a, b): 0 identical, about 1 unrelated, drawn on a white
// ramp, so a community is a bright block on the diagonal and a shape a
// dimmer block around it. The margin strips and the two boxes carry the
// shape hue; cells stay on the ramp.

export function mountMatrix(canvas) {
  const ctx = canvas.getContext('2d');
  let g = null, M = null, slots = new Map();
  let clusterOf = new Map(), clusterById = new Map(), shapeOfCluster = new Map(), nodesById = new Map(), edgeSet = new Set();
  let hidden = new Set(), hover = null, selectedId = null;

  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const visible = (id) => {
    const c = clusterOf.get(id), s = shapeOfCluster.get(c);
    return !hidden.has(`shape:${s}`) && !hidden.has(`cluster:${c}`);
  };

  function setData(graph, slotMap) {
    g = graph; M = g.matrix; slots = slotMap;
    clusterOf = new Map(); clusterById = new Map(g.clusters.map(c => [c.id, c]));
    for (const c of g.clusters) for (const m of c.members) clusterOf.set(m, c.id);
    shapeOfCluster = new Map(); for (const s of g.shapes) for (const c of s.clusters) shapeOfCluster.set(c, s.id);
    nodesById = new Map(g.nodes.map(n => [n.id, n]));
    edgeSet = new Set(g.edges.filter(e => e.kind === 'similar').map(e => pairKey(e.a, e.b)));
    hover = null;
    draw();
  }

  function visibleIndices() {
    const idx = [], ids = [];
    for (let k = 0; k < M.order.length; k++) { const id = M.order[k]; if (visible(id)) { idx.push(k); ids.push(id); } }
    return { idx, ids };
  }

  function runsOf(ids, keyFn) {
    const out = []; let start = 0;
    for (let k = 1; k <= ids.length; k++) {
      if (k === ids.length || keyFn(ids[k]) !== keyFn(ids[start])) { out.push({ start, end: k, key: keyFn(ids[start]) }); start = k; }
    }
    return out;
  }

  function draw() {
    const r = devicePixelRatio, box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, box.width * r); canvas.height = Math.max(1, box.height * r);
    ctx.save(); ctx.scale(r, r); ctx.clearRect(0, 0, box.width, box.height);
    if (!M) { ctx.restore(); canvas._geom = null; return; }

    const { idx, ids } = visibleIndices();
    const n = ids.length;
    if (!n) { ctx.restore(); canvas._geom = null; return; }
    const d = (i, j) => M.d[idx[i]][idx[j]];

    const gutter = 80, marginStrip = 4, padLeft = 12, padTop = 44, padRight = 16, padBottom = 100;
    const ox = padLeft + gutter + marginStrip, oy = padTop + marginStrip;
    const availW = box.width - ox - padRight, availH = box.height - oy - padBottom;
    const cell = Math.max(3, Math.min(availW, availH) / n);
    const grid = cell * n;

    // cells: white ramp, alpha .03 + .92 * v, v = 1 - clamp((ncd - .2) / .6, 0, 1)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 1 - Math.min(1, Math.max(0, (d(i, j) - 0.2) / 0.6));
      ctx.fillStyle = `rgba(255,255,255,${(0.03 + 0.92 * v).toFixed(3)})`;
      ctx.fillRect(ox + j * cell, oy + i * cell, Math.ceil(cell), Math.ceil(cell));
    }

    const clusterKey = (id) => clusterOf.get(id);
    const shapeKey = (id) => shapeOfCluster.get(clusterOf.get(id));
    const communityRuns = runsOf(ids, clusterKey);
    const shapeRuns = runsOf(ids, shapeKey);

    // per-community: 4px margin strip (top and left) and a 1px box at .35, in the shape hue
    for (const run of communityRuns) {
      const col = slotHex(slots.get(shapeOfCluster.get(run.key)));
      const w = (run.end - run.start) * cell;
      const x0 = ox + run.start * cell, y0 = oy + run.start * cell;
      ctx.globalAlpha = 1; ctx.fillStyle = col;
      ctx.fillRect(x0, oy - marginStrip, w, marginStrip);
      ctx.fillRect(ox - marginStrip, y0, marginStrip, w);
      ctx.globalAlpha = .35; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + .5, y0 + .5, Math.max(0, w - 1), Math.max(0, w - 1));
      ctx.globalAlpha = 1;
      if (w >= 40) {
        const c = clusterById.get(run.key);
        ctx.font = '10px Geist Mono, monospace'; ctx.fillStyle = SUBTLE; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(c ? c.name : '', ox - marginStrip - 6, y0 + w / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }
    // per-shape: 2px box at .5, in the shape hue, enclosing its communities
    for (const run of shapeRuns) {
      const col = slotHex(slots.get(run.key));
      const w = (run.end - run.start) * cell;
      const x0 = ox + run.start * cell, y0 = oy + run.start * cell;
      ctx.globalAlpha = .5; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, y0 + 1, Math.max(0, w - 2), Math.max(0, w - 2));
      ctx.globalAlpha = 1;
    }

    // selection: row/col white at .12, four brightest off-diagonal cells ringed white
    const si = selectedId ? ids.indexOf(selectedId) : -1;
    if (si >= 0) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(ox, oy + si * cell, grid, cell);
      ctx.fillRect(ox + si * cell, oy, cell, grid);
      const nearest = ids.map((_, k) => k).filter(k => k !== si).sort((a, b) => d(si, a) - d(si, b)).slice(0, 4);
      ctx.strokeStyle = WHITE; ctx.lineWidth = 1.2;
      for (const k of nearest) {
        const rad = Math.max(3, cell * .55);
        ctx.beginPath(); ctx.arc(ox + k * cell + cell / 2, oy + si * cell + cell / 2, rad, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ox + si * cell + cell / 2, oy + k * cell + cell / 2, rad, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // hover: white 1px outline on the cell, row/col fill white at .08
    if (hover && hover.i < n && hover.j < n) {
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(ox, oy + hover.i * cell, grid, cell);
      ctx.fillRect(ox + hover.j * cell, oy, cell, grid);
      ctx.strokeStyle = WHITE; ctx.lineWidth = 1;
      ctx.strokeRect(ox + hover.j * cell + .5, oy + hover.i * cell + .5, cell - 1, cell - 1);
    }

    // scale bar, 120px, same ramp, words at both ends, ticks at .50 and .62
    const barX = ox, barY = oy + grid + 24, barW = 120, barH = 8;
    for (let k = 0; k < barW; k++) {
      const v = 1 - k / barW;
      ctx.fillStyle = `rgba(255,255,255,${(0.03 + 0.92 * v).toFixed(3)})`;
      ctx.fillRect(barX + k, barY, 1, barH);
    }
    ctx.font = '10px Geist Mono, monospace'; ctx.fillStyle = SUBTLE; ctx.textAlign = 'left';
    const leftLabel = '.2 same', rightLabel = '.8 unrelated';
    ctx.fillText(leftLabel, barX, barY + barH + 13);
    const leftW = ctx.measureText(leftLabel).width, rightW = ctx.measureText(rightLabel).width;
    ctx.fillText(rightLabel, Math.max(barX + barW - rightW, barX + leftW + 10), barY + barH + 13);
    const tickX = (v) => barX + Math.min(1, Math.max(0, (v - 0.2) / 0.6)) * barW;
    const t50 = tickX(.50), t62 = tickX(.62);
    ctx.strokeStyle = MUTED; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(t50, barY - 3); ctx.lineTo(t50, barY + barH + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t62, barY - 3); ctx.lineTo(t62, barY + barH + 3); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = SUBTLE;
    ctx.fillText('same community below', t50, barY + barH + 26);
    ctx.fillText('same shape below', t62, barY + barH + 38);

    ctx.restore();
    canvas._geom = { ox, oy, cell, n, ids, idx };
  }

  canvas.addEventListener('mousemove', ev => {
    const geo = canvas._geom;
    if (!geo) return;
    const b = canvas.getBoundingClientRect();
    const x = ev.clientX - b.left - geo.ox, y = ev.clientY - b.top - geo.oy;
    if (x < 0 || y < 0 || x >= geo.n * geo.cell || y >= geo.n * geo.cell) { if (hover) { hover = null; hideTip(); draw(); } return; }
    const j = Math.floor(x / geo.cell), i = Math.floor(y / geo.cell);
    hover = { i, j };
    const idA = geo.ids[i], idB = geo.ids[j];
    const a = nodesById.get(idA), c = nodesById.get(idB);
    const ncd = M.d[geo.idx[i]][geo.idx[j]];
    const same = clusterOf.get(idA) === clusterOf.get(idB);
    const edge = edgeSet.has(pairKey(idA, idB));
    tip(ev, `${a?.task ?? 'session'} (${harnessName(a?.harness).toLowerCase()}) x ${c?.task ?? 'session'} (${harnessName(c?.harness).toLowerCase()}), ncd ${score(ncd)}${same ? ', same community' : ''}, ${edge ? 'edge' : 'no edge'}`);
    draw();
  });
  canvas.addEventListener('mouseleave', () => { hover = null; hideTip(); draw(); });
  canvas.addEventListener('click', () => { if (hover && canvas._geom) bus.emit('select-id', canvas._geom.ids[hover.i]); });
  window.addEventListener('resize', draw);
  bus.on('view', v => { if (v === 'matrix') draw(); });

  return {
    setData,
    select(id) { selectedId = id; draw(); },
    filter(hiddenSet) { hidden = hiddenSet; draw(); },
  };
}
