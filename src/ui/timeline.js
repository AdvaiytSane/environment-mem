import { $, bus, esc, tip, hideTip, MINT, NODE_GREY, RED, SUBTLE } from './shared.js';

// Sessions view: one column per task, every column on one y axis. Cold runs
// in --node-grey left of the column centre, headstart (arm 'full') runs in
// mint on the right. Two chips swap the measure; dots interpolate to their
// new height rather than re-rising. docs/UI-BRIEF.md 4.3.

export function mountTimeline(canvas) {
  const ctx = canvas.getContext('2d');
  let runs = [], live = [], meta = {};
  let measure = 'calls';           // 'calls' or 'discovery'
  let swap = null;                 // { start, prevMeasure, prevMax }
  let entranceStart = null, enteredOnce = false;

  const valueOf = (r, m) => Number(r[m] || 0);
  const measureLabel = (m) => m === 'discovery' ? 'before first edit per session' : 'tool calls per session';
  const maxOf = (m) => Math.max(1, ...runs.map(x => valueOf(x, m)), ...live.map(x => valueOf(x, m)));

  function buildChips() {
    const el = $('#tchips'); if (!el) return;
    el.innerHTML = '';
    for (const [key, label] of [['calls', 'tool calls'], ['discovery', 'before first edit']]) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip-btn'; b.textContent = label; b.dataset.key = key;
      b.setAttribute('aria-pressed', measure === key ? 'true' : 'false');
      b.onclick = () => { if (measure === key) return; swapMeasure(key); };
      el.appendChild(b);
    }
  }
  function refreshChips() {
    const el = $('#tchips'); if (!el) return;
    for (const b of el.children) b.setAttribute('aria-pressed', b.dataset.key === measure ? 'true' : 'false');
  }
  function swapMeasure(key) {
    swap = { start: performance.now(), prevMeasure: measure, prevMax: maxOf(measure) };
    measure = key;
    refreshChips();
    requestAnimationFrame(draw);
  }

  function updateStats() {
    const el = $('#tstats'); if (!el) return;
    if (!runs.length) { el.innerHTML = ''; return; }
    const tasks = [...new Set(runs.map(r => r.task))];
    const cold = runs.filter(r => r.arm === 'cold'), hs = runs.filter(r => r.arm === 'full');
    const perTaskCold = tasks.length ? Math.round(cold.length / tasks.length) : 0;
    const perTaskHs = tasks.length ? Math.round(hs.length / tasks.length) : 0;
    const n = meta.n ?? runs.length;
    el.innerHTML = `<span>${n} runs, <b>${perTaskCold}</b> cold and <b>${perTaskHs}</b> headstart per task, ${esc(meta.runner ?? '')} ${esc(meta.model ?? '')}</span>`;
  }

  function setRuns(rs, m) {
    runs = (rs || []).filter(r => r.arm === 'cold' || r.arm === 'full');
    meta = m || {};
    buildChips();
    updateStats();
    draw();
  }
  function addLive(r) {
    live.push({ ...r, _t: performance.now() });
    requestAnimationFrame(draw);
  }

  function layout() {
    const tasks = [...new Set(runs.map(r => r.task))];
    if (live.length) tasks.push('live');
    return tasks;
  }

  function draw() {
    const r = devicePixelRatio, box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    canvas.width = box.width * r; canvas.height = box.height * r;
    ctx.save(); ctx.scale(r, r); ctx.clearRect(0, 0, box.width, box.height);
    const tasks = layout();
    if (!tasks.length) { ctx.restore(); canvas._tasks = null; return; }

    const pl = 64, pr = 32, pt = 64, pb = 56;
    const W = box.width, H = box.height;
    const now = performance.now();
    const curMax = maxOf(measure);
    const swapT = swap ? Math.min(1, (now - swap.start) / 320) : 1;
    let animating = !!(swap && swapT < 1);

    const yFor = (v, max) => H - pb - (H - pt - pb) * v / max;
    const gx = i => pl + (W - pl - pr) * (i + .5) / tasks.length;

    ctx.font = '11px Geist Mono, monospace';
    for (const v of [0, Math.round(curMax / 2), curMax]) {
      const yy = yFor(v, curMax);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(pl, yy); ctx.lineTo(W - pr, yy); ctx.stroke();
      ctx.fillStyle = SUBTLE; ctx.textAlign = 'right'; ctx.fillText(String(v), pl - 10, yy + 4);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = SUBTLE;
    ctx.fillText(measureLabel(measure), pl, pt - 20);

    tasks.forEach((t, i) => {
      const cx = gx(i);
      ctx.textAlign = 'center'; ctx.fillStyle = SUBTLE; ctx.fillText(t, cx, H - pb + 20);

      const cold = t === 'live' ? live.filter(x => x.arm === 'cold') : runs.filter(x => x.task === t && x.arm === 'cold');
      const hs = t === 'live' ? live.filter(x => x.arm === 'full') : runs.filter(x => x.task === t && x.arm === 'full');

      let reveal = 1;
      if (entranceStart !== null) {
        reveal = Math.min(1, Math.max(0, (now - entranceStart - i * 120) / 400));
        if (reveal < 1) animating = true;
      }
      if (reveal <= 0) return;
      ctx.globalAlpha = reveal;

      const plot = (list, baseX, color, isLive) => {
        list.forEach((x, k) => {
          const val = valueOf(x, measure);
          let yy;
          if (swap && swapT < 1) {
            const yOld = yFor(valueOf(x, swap.prevMeasure), swap.prevMax);
            const yNew = yFor(val, curMax);
            yy = yOld + (yNew - yOld) * swapT;
          } else {
            yy = yFor(val, curMax);
          }
          if (isLive && x._t) {
            const liveT = Math.min(1, Math.max(0, (now - x._t - k * 30) / 320));
            if (liveT < 1) animating = true;
            yy = (H - pb) + (yy - (H - pb)) * liveT;
          }
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(baseX + (k % 4) * 3, yy, 3.2, 0, Math.PI * 2); ctx.fill();
        });
      };
      plot(cold, cx - 16, NODE_GREY, t === 'live');
      plot(hs, cx + 16, MINT, t === 'live');

      const mean = a => a.length ? a.reduce((s, x) => s + valueOf(x, measure), 0) / a.length : null;
      const mc = mean(cold), mh = mean(hs);
      if (mc !== null && mh !== null) {
        const ymc = yFor(mc, curMax), ymh = yFor(mh, curMax);
        ctx.strokeStyle = mh <= mc ? MINT : RED; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx - 12, ymc); ctx.lineTo(cx + 12, ymh); ctx.stroke();
        if (mc > 0) {
          const dl = Math.round((mh / mc - 1) * 100);
          ctx.fillStyle = SUBTLE; ctx.textAlign = 'left';
          ctx.fillText(`${dl > 0 ? '+' : ''}${dl}%`, cx + 26, (ymc + ymh) / 2 + 4);
        }
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    canvas._tasks = tasks; canvas._geom = { pl, pr, W };
    if (swap && swapT >= 1) swap = null;
    if (animating) requestAnimationFrame(draw);
  }

  canvas.addEventListener('mousemove', ev => {
    const tasks = canvas._tasks || [], geo = canvas._geom;
    if (!tasks.length || !geo) { hideTip(); return; }
    const b = canvas.getBoundingClientRect();
    const i = Math.floor((ev.clientX - b.left - geo.pl) / (b.width - geo.pl - geo.pr) * tasks.length);
    const t = tasks[i]; if (!t) { hideTip(); return; }
    const cold = t === 'live' ? live.filter(x => x.arm === 'cold') : runs.filter(x => x.task === t && x.arm === 'cold');
    const hs = t === 'live' ? live.filter(x => x.arm === 'full') : runs.filter(x => x.task === t && x.arm === 'full');
    const mean = a => a.length ? (a.reduce((s, x) => s + valueOf(x, measure), 0) / a.length) : null;
    const mc = mean(cold), mh = mean(hs);
    if (mc === null && mh === null) { hideTip(); return; }
    let delta = '';
    if (mc && mh !== null) { const dl = Math.round((mh / mc - 1) * 100); delta = `, ${dl > 0 ? '+' : ''}${dl}%`; }
    tip(ev, `${t}, cold ${mc !== null ? mc.toFixed(1) : '-'} (n=${cold.length}), headstart ${mh !== null ? mh.toFixed(1) : '-'} (n=${hs.length})${delta}`);
  });
  canvas.addEventListener('mouseleave', hideTip);
  window.addEventListener('resize', draw);
  bus.on('view', v => {
    if (v !== 'sessions') return;
    if (!enteredOnce) { enteredOnce = true; entranceStart = performance.now(); }
    draw();
  });

  return { setRuns, addLive };
}
