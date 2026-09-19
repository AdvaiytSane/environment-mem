import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Run } from './eval.ts';
import { summarize, type Summary } from './report.ts';

const ARM_LABEL: Record<string, string> = { cold: 'Cold', doc: 'Hand-written doc', autodoc: 'Generated doc', facts: 'Repo facts', full: 'Procedure' };

function esc(s: unknown): string { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
function n(x: number): string { return Math.round(x).toLocaleString('en-US'); }
function pct(a: number, b: number): string { return b ? `${a <= b ? '-' : '+'}${Math.abs(Math.round((1 - a / b) * 100))}%` : ''; }

export function renderConsole(runs: Run[], s: Summary, title = 'headstart'): string {
  const arms = Object.keys(s.arms);
  const cold = s.arms.cold;
  const maxTok = Math.max(...arms.map(a => s.arms[a].context_tokens.mean));
  const bars = arms.map(a => {
    const m = s.arms[a];
    const w = maxTok ? Math.max(2, Math.round(m.context_tokens.mean / maxTok * 100)) : 0;
    return `<div class="row"><div class="lab">${esc(ARM_LABEL[a] ?? a)}<span class="n">n=${m.context_tokens.n}</span></div>
      <div class="track"><div class="bar${a === 'cold' ? ' base' : ''}" style="width:${w}%"></div></div>
      <div class="val">${n(m.context_tokens.mean)}<span class="d">${a === 'cold' ? '' : pct(m.context_tokens.mean, cold?.context_tokens.mean ?? 0)}</span></div></div>`;
  }).join('\n');
  const metricRows = ([
    ['context tokens', 'context_tokens'], ['tool calls', 'tool_calls'], ['calls before first edit', 'discovery_calls'],
    ['seconds', 'duration_s'], ['cost', 'cost_usd'],
  ] as [string, keyof Run][]).map(([label, key]) => `<tr><td>${label}</td>${arms.map(a => {
    const m = s.arms[a][key];
    if (key === 'cost_usd' && runs.every(r => r.cost_usd === 0)) return '<td class="num">not reported</td>';
    const v = key === 'cost_usd' ? `$${m.mean.toFixed(3)}` : n(m.mean);
    return `<td class="num">${v}<span class="sd">± ${key === 'cost_usd' ? m.sd.toFixed(3) : n(m.sd)}</span>${a === 'cold' ? '' : `<span class="d">${pct(m.mean, cold?.[key].mean ?? 0)}</span>`}</td>`;
  }).join('')}</tr>`).join('\n');
  const passRow = `<tr><td>tests pass</td>${arms.map(a => `<td class="num">${Math.round(s.pass[a] * 100)}%</td>`).join('')}</tr>`;
  const fleet = Object.entries(s.fleet).map(([a, f]) => `<tr><td>${esc(ARM_LABEL[a] ?? a)}</td><td class="num">${n(f.tokens)}</td><td class="num">${n(f.minutes)}</td><td class="num">${n(f.acu)}</td><td class="num">${runs.every(r => r.cost_usd === 0) ? 'not reported' : `$${n(f.usd)}`}</td></tr>`).join('\n');
  const runRows = runs.map(r => `<tr><td>${esc(r.task)}</td><td>${esc(ARM_LABEL[r.arm] ?? r.arm)}</td><td class="num">${r.repeat}</td><td>${esc(r.runner)}</td><td class="num">${n(r.context_tokens)}</td><td class="num">${r.tool_calls}</td><td class="num">${r.discovery_calls}</td><td class="num">${r.duration_s}</td><td class="num">${r.cost_usd ? `$${r.cost_usd.toFixed(3)}` : 'n/a'}</td><td class="${r.pass ? 'ok' : 'bad'}">${r.pass ? 'pass' : 'fail'}</td><td class="num">${r.injected_chars}</td>${r.error ? `<td class="bad">${esc(r.error.slice(0, 80))}</td>` : '<td></td>'}</tr>`).join('\n');
  const runner = runs[0]?.runner ?? '';
  const model = runs[0]?.model ?? '';
  return `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#f6f5f1;--ink:#1c1b18;--mute:#6b6862;--line:#d9d6cd;--panel:#fff;--accent:#8a4b1f;--ok:#2f6b3a;--bad:#9c2b2b;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#141412;--ink:#ebe8e0;--mute:#9a968c;--line:#2e2d29;--panel:#1c1b18;--accent:#d69a6a;--ok:#7fbf8a;--bad:#e07b7b}}
body{margin:0;padding:32px 20px 80px;background:var(--bg);color:var(--ink);font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
main{max-width:1100px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px;font-weight:600}.sub{color:var(--mute);margin:0 0 32px}
h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:36px 0 12px;font-weight:500}
.row{display:grid;grid-template-columns:160px 1fr 180px;gap:12px;align-items:center;margin:6px 0}
.lab .n{color:var(--mute);margin-left:8px;font-size:12px}
.track{height:18px;background:var(--panel);border:1px solid var(--line)}.bar{height:100%;background:var(--accent);opacity:.85}.bar.base{opacity:.35}
.val{font-variant-numeric:tabular-nums}.d{color:var(--mute);margin-left:8px;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--mute);font-weight:500}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}.sd{color:var(--mute);font-size:11px;margin-left:6px}
.ok{color:var(--ok)}.bad{color:var(--bad)}.wrap{overflow-x:auto}
</style>
<main>
<h1>${esc(title)}</h1>
<p class="sub">${runs.length} runs, ${esc(runner)} ${esc(model)}. Cold is the baseline. Mean ± standard deviation over runs without errors.</p>
<h2>Context tokens per session</h2>
${bars}
<h2>Per session</h2>
<div class="wrap"><table><tr><th>metric</th>${arms.map(a => `<th class="num">${esc(ARM_LABEL[a] ?? a)}</th>`).join('')}</tr>${metricRows}${passRow}</table></div>
${fleet ? `<h2>Fleet of 9,000 sessions, projected from the mean delta</h2>
<div class="wrap"><table><tr><th>arm</th><th class="num">context tokens saved</th><th class="num">minutes saved</th><th class="num">ACU saved</th><th class="num">cost saved</th></tr>${fleet}</table></div>` : ''}
<h2>Runs</h2>
<div class="wrap"><table><tr><th>task</th><th>arm</th><th class="num">#</th><th>runner</th><th class="num">ctx tok</th><th class="num">tools</th><th class="num">before edit</th><th class="num">s</th><th class="num">$</th><th>check</th><th class="num">injected</th><th></th></tr>${runRows}</table></div>
</main>
`;
}

export function writeConsole(dir: string): string {
  const f = join(dir, 'runs.jsonl');
  if (!existsSync(f)) throw new Error(`no runs at ${f}`);
  const runs = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Run);
  const out = join(dir, 'console.html');
  writeFileSync(out, renderConsole(runs, summarize(runs)));
  return out;
}
