import { esc, fmt, MINUS } from './shared.js';

// The Measured view: the receipt for the numbers the presenter reads out.
// docs/UI-BRIEF.md 4.4. summary = { summary: { arms, pass, fleet, delta }, runner, model, n, runs }.

const LABEL = { cold: 'cold', doc: 'hand-written doc', autodoc: 'generated doc', facts: 'repo facts', full: 'headstart' };
const STATS = [
  { label: 'Tool calls', key: 'tool_calls', unit: '' },
  { label: 'Before first edit', key: 'discovery_calls', unit: '' },
  { label: 'Time', key: 'duration_s', unit: 's' },
  { label: 'Money', key: 'cost_usd', unit: '$' },
];
const COLS = [
  { label: 'Tool calls', key: 'tool_calls', unit: '' },
  { label: 'Before first edit', key: 'discovery_calls', unit: '' },
  { label: 'Tokens', key: 'context_tokens', unit: 'tok', tip: 'includes cache reads' },
  { label: 'Time', key: 'duration_s', unit: 's' },
  { label: 'Money', key: 'cost_usd', unit: '$', tip: 'the paid number' },
];
const FLEET_COLS = [
  { label: 'Tokens', key: 'tokens', ciKey: 'tokens_ci', unit: 'tok' },
  { label: 'Minutes', key: 'minutes', ciKey: 'minutes_ci', unit: '' },
  { label: 'ACU', key: 'acu', ciKey: null, unit: '' },
  { label: 'Money', key: 'usd', ciKey: 'usd_ci', unit: '$' },
];

function fmtRaw(v, unit) {
  if (v == null || Number.isNaN(v)) return String.fromCharCode(0x2014);
  if (unit === 'tok') return fmt(v);
  if (unit === 's') return `${Math.round(v)}s`;
  if (unit === '$') return `$${v.toFixed(3)}`;
  return v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
}
function pctStr(p) {
  const r = Math.round(p);
  if (r === 0) return '0%';
  return `${r < 0 ? MINUS : '+'}${Math.abs(r)}%`;
}
function pctClass(p) { return p < 0 ? 'good' : p > 0 ? 'bad' : ''; }

export function mountMeasured(el) {
  function render(payload) {
    if (!payload || !payload.summary) {
      el.innerHTML = `<div class="lead">No results yet.</div><div class="basis">Run <code>headstart eval</code> to write a results directory, then point the console at it with <code>--results</code>.</div>`;
      return;
    }
    const s = payload.summary;
    const arms = Object.keys(s.arms);
    const cold = s.arms.cold;
    const full = s.arms.full;
    const dFull = s.delta && s.delta.full;
    const tasks = new Set((payload.runs || []).map(r => r.task)).size;
    const noCost = arms.every(a => (s.arms[a].cost_usd?.mean ?? 0) === 0);

    const parts = [];

    // head: lead delta, basis line
    if (cold && full && dFull) {
      const pct = dFull.tool_calls.pct, ci = dFull.tool_calls.ci_pct;
      const mag = Math.abs(pct);
      const lo = Math.round(mag - ci), hi = Math.round(mag + ci);
      const word = pct <= 0 ? 'fewer' : 'more';
      parts.push(`<div class="lead">${Math.round(mag)}% ${word} tool calls</div>`);
      parts.push(`<div class="basis">than cold, over ${payload.n ?? s.n ?? ''} runs of ${tasks} tasks, ${esc(payload.runner ?? '')} with ${esc(payload.model ?? '')}. The 95% interval on that delta is ${lo} to ${hi}%.</div>`);
    } else {
      parts.push(`<div class="lead">No headstart runs yet.</div>`);
    }

    // four stats
    if (cold && full && dFull) {
      const stats = STATS.map(({ label, key, unit }) => {
        if (key === 'cost_usd' && noCost) {
          return `<div class="stat"><div class="k">${esc(label)}</div><div class="v zero" title="not reported by runner">${String.fromCharCode(0x2014)}</div><div class="note">not reported by runner</div></div>`;
        }
        const pct = dFull[key].pct;
        const cls = pctClass(pct);
        const note = `${fmtRaw(full[key].mean, unit)} vs ${fmtRaw(cold[key].mean, unit)} per session`;
        return `<div class="stat"><div class="k">${esc(label)}</div><div class="v ${cls || 'zero'}">${pctStr(pct)}</div><div class="note">${note}</div></div>`;
      }).join('');
      parts.push(`<div class="stats-row">${stats}</div>`);
    }

    // table
    let table = `<table><thead><tr><th>Arm</th><th>n</th>`;
    for (const c of COLS) table += `<th${c.tip ? ` title="${esc(c.tip)}"` : ''}>${esc(c.label)}</th>`;
    table += `<th>Tests pass</th></tr></thead><tbody>`;
    for (const arm of arms) {
      const row = s.arms[arm];
      const n = row.tool_calls.n;
      table += `<tr><td>${esc(LABEL[arm] ?? arm)}</td><td>${n}</td>`;
      for (const c of COLS) {
        if (c.key === 'cost_usd' && noCost) { table += `<td><span class="dash" title="not reported by runner">${String.fromCharCode(0x2014)}</span></td>`; continue; }
        if (arm === 'cold' || !s.delta[arm]) {
          table += `<td>${fmtRaw(row[c.key].mean, c.unit)}</td>`;
        } else {
          const pct = s.delta[arm][c.key].pct;
          const cls = pctClass(pct);
          table += `<td><span class="${cls}">${pctStr(pct)}</span><span class="raw">${fmtRaw(row[c.key].mean, c.unit)}</span></td>`;
        }
      }
      const passN = Math.round((s.pass[arm] ?? 0) * n);
      table += `<td title="${passN} of ${n}">${Math.round((s.pass[arm] ?? 0) * 100)}%</td></tr>`;
    }
    table += `</tbody></table>`;
    parts.push(table);
    parts.push(`<div class="note">mean per session over successful runs; n per arm in the second column; the head's interval is a 95% interval on the mean delta</div>`);

    // fleet table
    if (s.fleet && Object.keys(s.fleet).length) {
      parts.push(`<div class="head">Fleet of 9,000 sessions</div>`);
      let fleet = `<table><thead><tr><th>Arm</th>`;
      for (const c of FLEET_COLS) fleet += `<th>${esc(c.label)}</th>`;
      fleet += `</tr></thead><tbody>`;
      for (const [arm, f] of Object.entries(s.fleet)) {
        fleet += `<tr><td>${esc(LABEL[arm] ?? arm)}</td>`;
        for (const c of FLEET_COLS) {
          if (c.unit === '$' && noCost) { fleet += `<td><span class="dash" title="not reported by runner">${String.fromCharCode(0x2014)}</span></td>`; continue; }
          const v = fmtRaw(f[c.key], c.unit);
          const ciTxt = c.ciKey && f[c.ciKey] != null ? `<span class="raw">± ${fmtRaw(f[c.ciKey], c.unit)}</span>` : '';
          fleet += `<td>${v}${ciTxt}</td>`;
        }
        fleet += `</tr>`;
      }
      fleet += `</tbody></table>`;
      parts.push(fleet);
      parts.push(`<div class="note">mean delta times 9,000 sessions; ± is a 95% interval on the mean delta; 1 ACU is 15 minutes</div>`);
    }

    el.innerHTML = parts.join('');
  }
  return { render };
}
