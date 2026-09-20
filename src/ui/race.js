import { esc } from './shared.js';
const $ = (s, r = document) => r.querySelector(s);

// The race: one task, two lanes at once. Left runs with nothing, right is
// handed the procedure. Steps stream in from each lane's trace; tokens come
// from the runner's running totals; the clock runs until each side finishes.

const DEFAULT_TASK = 'endpoint-3';
const fmtK = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n ?? 0);
const tokensOf = (side) => {
  const c = side.result?.cost; if (c && (c.input_tokens ?? c.cached_input_tokens ?? c.output_tokens) !== undefined) return (c.input_tokens ?? 0) + (c.cached_input_tokens ?? 0) + (c.output_tokens ?? 0);
  const p = side.progress; return p ? p.input + p.cached + p.output : 0;
};
const TOOL_CLASS = { exec: 'sky', bash: 'sky', read: 'lav', grep: 'lav', glob: 'lav', search: 'lav', edit: 'mint', write: 'mint', multiedit: 'mint' };

export function mountRace(root) {
  root.innerHTML = `
    <div class="race-top">
      <select id="race-task" aria-label="task"></select>
      <select id="race-agent" aria-label="agent"><option value="devin">Devin CLI</option><option value="claude">Claude Code</option></select>
      <button class="go" id="race-go" type="button">Go</button>
      <span class="note" id="race-note">Enter starts both runs.</span>
    </div>
    <div class="race-prompt" id="race-prompt"></div>
    <div class="race-grid">
      ${['cold', 'warm'].map((s) => `
      <div class="race-side" data-side="${s}">
        <div class="race-head">
          <span class="race-label ${s}">${s === 'cold' ? 'Without DejaDo' : 'With DejaDo'}</span>
          <span class="race-nums"><b id="race-${s}-steps">0</b> steps · <b id="race-${s}-tokens">0</b> tokens · <b id="race-${s}-time">0.0s</b> <i id="race-${s}-state"></i></span>
        </div>
        <ol class="race-steps" id="race-${s}-steps-list"></ol>
      </div>`).join('')}
    </div>
    <div class="race-delta" id="race-delta"></div>`;
  const taskSel = $('#race-task', root), agentSel = $('#race-agent', root), go = $('#race-go', root), note = $('#race-note', root), prompt = $('#race-prompt', root);
  let tasks = [];
  fetch('/api/tasks').then((r) => r.json()).then((j) => {
    tasks = j.tasks;
    taskSel.innerHTML = tasks.map((t) => `<option value="${esc(t.id)}"${t.id === DEFAULT_TASK ? ' selected' : ''}>${esc(t.id)} · ${esc(t.prompt.split(/[.:]/)[0].slice(0, 70))}</option>`).join('');
    showPrompt();
  });
  const showPrompt = () => { const t = tasks.find((x) => x.id === taskSel.value); prompt.textContent = t ? t.prompt : ''; };
  taskSel.onchange = showPrompt;

  let id = null, timer = null, startedAt = 0, done = { cold: false, warm: false };
  const render = (d) => {
    const now = Date.now();
    for (const s of ['cold', 'warm']) {
      const side = d[s];
      const list = $(`#race-${s}-steps-list`, root);
      const rendered = list.children.length;
      side.steps.slice(rendered).forEach((st, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="n">${String(rendered + i + 1).padStart(2, '0')}</span><span class="tool ${TOOL_CLASS[String(st.tool).toLowerCase()] ?? ''}">${esc(st.tool)}</span><span class="txt" title="${esc(st.text)}">${esc(st.text)}</span><span class="at">${st.at}s</span>`;
        list.appendChild(li); list.scrollTop = list.scrollHeight;
      });
      $(`#race-${s}-steps`, root).textContent = side.steps.length;
      $(`#race-${s}-tokens`, root).textContent = fmtK(tokensOf(side));
      const finished = !!side.result;
      const t0 = side.startedAt ?? startedAt;
      const secs = finished ? side.result.durationS : Math.max(0, (now - t0) / 1000);
      $(`#race-${s}-time`, root).textContent = finished ? `${secs}s` : `${secs.toFixed(1)}s`;
      const state = $(`#race-${s}-state`, root);
      state.textContent = finished ? (side.result.verification?.status === 'passed' ? 'passed' : side.result.error ? 'failed' : 'done') : side.steps.length ? 'running' : side.exists ? 'starting' : 'waiting';
      state.className = finished ? (side.result.verification?.status === 'passed' ? 'ok' : 'bad') : 'run';
      if (s === 'warm' && side.handed && !list.dataset.handed) { list.dataset.handed = '1'; const li = document.createElement('li'); li.className = 'handed'; li.textContent = `handed ${side.handed} procedure${side.handed > 1 ? 's' : ''} before the first step`; list.prepend(li); }
      done[s] = finished;
    }
    if (done.cold && done.warm) {
      clearInterval(timer); timer = null; go.disabled = false; note.textContent = 'Both finished.';
      const c = d.cold, w = d.warm;
      const line = (label, a, b, f) => { const dd = a - b; if (!a) return ''; return `<span>${label} <b class="${dd > 0 ? 'ok' : dd < 0 ? 'bad' : ''}">${dd > 0 ? '−' : dd < 0 ? '+' : ''}${f(Math.abs(dd))}${dd ? ` (${Math.round(Math.abs(dd) / a * 100)}%)` : ' same'}</b></span>`; };
      $('#race-delta', root).innerHTML = line('steps', c.steps.length, w.steps.length, String) + line('tokens', tokensOf(c), tokensOf(w), fmtK) + line('time', c.result.durationS, w.result.durationS, (n) => `${n}s`);
    }
  };
  const poll = async () => { if (!id) return; try { render(await (await fetch(`/api/race?id=${id}`)).json()); } catch {} };
  const start = async () => {
    if (timer) return;
    go.disabled = true; note.textContent = 'Starting both lanes.'; $('#race-delta', root).innerHTML = '';
    for (const s of ['cold', 'warm']) { const l = $(`#race-${s}-steps-list`, root); l.innerHTML = ''; delete l.dataset.handed; }
    done = { cold: false, warm: false };
    const r = await (await fetch('/api/race', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: taskSel.value, agent: agentSel.value }) })).json();
    if (!r.ok) { note.textContent = 'Could not start.'; go.disabled = false; return; }
    id = r.id; startedAt = r.startedAt; note.textContent = `Running ${agentSel.options[agentSel.selectedIndex].text} twice.`;
    timer = setInterval(poll, 1000);
  };
  go.onclick = start;
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !timer) { e.preventDefault(); start(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && root.closest('.view')?.classList.contains('on') && !timer && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) start(); });
  return { start };
}
