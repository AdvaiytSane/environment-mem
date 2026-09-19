import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Arm, Run } from './eval.ts';

const FLEET = 9000;
const ACU_MINUTES = 15;

const METRICS: { key: keyof Run; label: string; unit: string }[] = [
  { key: 'context_tokens', label: 'context tokens (input + cache reads + cache writes, all turns)', unit: 'tok' },
  { key: 'input_tokens', label: 'uncached input tokens', unit: 'tok' },
  { key: 'cache_read', label: 'cache read tokens', unit: 'tok' },
  { key: 'output_tokens', label: 'output tokens', unit: 'tok' },
  { key: 'tool_calls', label: 'tool calls', unit: '' },
  { key: 'discovery_calls', label: 'calls before first edit', unit: '' },
  { key: 'turns', label: 'turns', unit: '' },
  { key: 'duration_s', label: 'seconds', unit: 's' },
  { key: 'cost_usd', label: 'cost', unit: '$' },
];

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function sd(xs: number[]): number { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; }
function fmt(n: number, unit: string): string {
  if (unit === '$') return `$${n.toFixed(3)}`;
  if (unit === 'tok') return Math.round(n).toLocaleString('en-US');
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1);
}
function pct(a: number, b: number): string { return b ? `${a <= b ? '-' : '+'}${Math.abs(Math.round((1 - a / b) * 100))}%` : 'n/a'; }

export interface Summary { arms: Record<string, Record<string, { mean: number; sd: number; n: number }>>; pass: Record<string, number>; fleet: Record<string, Record<string, number>>; n: number }

// Half-width of a 95% interval on the difference of two means, both sampled.
function ci(a: { sd: number; n: number }, b: { sd: number; n: number }): number {
  if (!a.n || !b.n) return 0;
  return 1.96 * Math.sqrt(a.sd ** 2 / a.n + b.sd ** 2 / b.n);
}

export function summarize(runs: Run[]): Summary {
  const arms = [...new Set(runs.map(r => r.arm))];
  const out: Summary = { arms: {}, pass: {}, fleet: {}, n: runs.length };
  for (const arm of arms) {
    const rs = runs.filter(r => r.arm === arm && !r.error);
    out.arms[arm] = {};
    for (const m of METRICS) {
      const xs = rs.map(r => Number(r[m.key]));
      out.arms[arm][m.key] = { mean: mean(xs), sd: sd(xs), n: xs.length };
    }
    out.pass[arm] = rs.length ? rs.filter(r => r.pass).length / rs.length : 0;
  }
  const cold = out.arms.cold;
  if (cold) for (const arm of arms.filter(a => a !== 'cold')) {
    const a = out.arms[arm];
    const dTok = cold.context_tokens.mean - a.context_tokens.mean;
    const dSec = cold.duration_s.mean - a.duration_s.mean;
    const dCost = cold.cost_usd.mean - a.cost_usd.mean;
    out.fleet[arm] = {
      tokens: dTok * FLEET, minutes: dSec / 60 * FLEET, acu: dSec / 60 / ACU_MINUTES * FLEET, usd: dCost * FLEET,
      tokens_ci: ci(cold.context_tokens, a.context_tokens) * FLEET,
      minutes_ci: ci(cold.duration_s, a.duration_s) / 60 * FLEET,
      usd_ci: ci(cold.cost_usd, a.cost_usd) * FLEET,
    };
  }
  return out;
}

export function renderMarkdown(runs: Run[], s: Summary): string {
  const arms = Object.keys(s.arms);
  const L: string[] = [];
  L.push(`# headstart eval`, '');
  L.push(`${s.n} runs, runner ${runs[0]?.runner ?? '?'}, model ${runs[0]?.model ?? '?'}. Arms: ${arms.join(', ')}. Mean and standard deviation over successful runs.`, '');
  L.push(`| metric | ${arms.map(a => `${a} (n=${s.arms[a].context_tokens.n})`).join(' | ')} | ${arms.filter(a => a !== 'cold').map(a => `${a} vs cold`).join(' | ')} |`);
  L.push(`|---|${arms.map(() => '---:').join('|')}|${arms.filter(a => a !== 'cold').map(() => '---:').join('|')}|`);
  // Devin's ATIF export carries token counts and no price, so cost is
  // absent there, not zero.
  const noCost = runs.every(r => r.cost_usd === 0);
  for (const m of METRICS) {
    if (m.key === 'cost_usd' && noCost) { L.push(`| cost | ${arms.map(() => 'not reported by runner').join(' | ')} | ${arms.filter(a => a !== 'cold').map(() => '').join(' | ')} |`); continue; }
    const cells = arms.map(a => `${fmt(s.arms[a][m.key].mean, m.unit)} ± ${fmt(s.arms[a][m.key].sd, m.unit)}`);
    const deltas = arms.filter(a => a !== 'cold').map(a => pct(s.arms[a][m.key].mean, s.arms.cold?.[m.key].mean ?? 0));
    L.push(`| ${m.label} | ${cells.join(' | ')} | ${deltas.join(' | ')} |`);
  }
  L.push(`| tests pass | ${arms.map(a => `${Math.round(s.pass[a] * 100)}%`).join(' | ')} | ${arms.filter(a => a !== 'cold').map(() => '').join(' | ')} |`, '');
  if (Object.keys(s.fleet).length) {
    L.push(`## Fleet of ${FLEET.toLocaleString('en-US')} sessions (projection: mean delta x ${FLEET.toLocaleString('en-US')}, ± is a 95% interval on the mean delta)`, '');
    L.push(`| arm | context tokens saved | minutes saved | ACU saved (${ACU_MINUTES} min each) | cost saved |`, `|---|---:|---:|---:|---:|`);
    for (const [arm, f] of Object.entries(s.fleet)) L.push(`| ${arm} | ${Math.round(f.tokens).toLocaleString('en-US')} ± ${Math.round(f.tokens_ci).toLocaleString('en-US')} | ${Math.round(f.minutes).toLocaleString('en-US')} ± ${Math.round(f.minutes_ci).toLocaleString('en-US')} | ${Math.round(f.acu).toLocaleString('en-US')} | ${noCost ? 'not reported' : `$${Math.round(f.usd).toLocaleString('en-US')} ± ${Math.round(f.usd_ci).toLocaleString('en-US')}`} |`);
    L.push('', 'Context tokens are mostly cache reads on Claude Code (about 97 out of 100). The cost column is the number that reflects what is paid.');
    L.push('');
  }
  const shapes = [...new Set(runs.map(r => r.shape))];
  L.push(`## By shape (context tokens, tool calls, pass)`, '');
  L.push(`| shape | ${arms.join(' | ')} |`, `|---|${arms.map(() => '---').join('|')}|`);
  for (const sh of shapes) {
    const cells = arms.map(a => {
      const rs = runs.filter(r => r.shape === sh && r.arm === a && !r.error);
      if (!rs.length) return 'n/a';
      return `${fmt(mean(rs.map(r => r.context_tokens)), 'tok')} / ${fmt(mean(rs.map(r => r.tool_calls)), '')} / ${Math.round(rs.filter(r => r.pass).length / rs.length * 100)}%`;
    });
    L.push(`| ${sh} | ${cells.join(' | ')} |`);
  }
  L.push('');
  const errs = runs.filter(r => r.error);
  if (errs.length) { L.push(`## Errors (${errs.length})`, ''); for (const r of errs) L.push(`- ${r.task} ${r.arm} #${r.repeat}: ${r.error}`); L.push(''); }
  L.push(`## Runs`, '', `| task | arm | # | ctx tok | out tok | tools | before edit | s | $ | pass | injected |`, `|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|`);
  for (const r of runs) L.push(`| ${r.task} | ${r.arm} | ${r.repeat} | ${fmt(r.context_tokens, 'tok')} | ${fmt(r.output_tokens, 'tok')} | ${r.tool_calls} | ${r.discovery_calls} | ${r.duration_s} | ${noCost ? 'n/a' : r.cost_usd.toFixed(3)} | ${r.pass ? 'yes' : 'no'} | ${r.injected_chars} |`);
  return L.join('\n') + '\n';
}

export function report(dir: string): string {
  const f = join(dir, 'runs.jsonl');
  if (!existsSync(f)) throw new Error(`no runs at ${f}`);
  const runs = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Run);
  const s = summarize(runs);
  const md = renderMarkdown(runs, s);
  writeFileSync(join(dir, 'report.md'), md);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(s, null, 2));
  return md;
}
