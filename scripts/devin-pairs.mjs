// Side-by-side traces for the console's Evals page: for every task in a
// recorded Devin eval round, the cold run and the run that was handed the
// procedure, step by step, with the recorded totals.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
const dir = process.argv[2] || 'results/devin-sonnet-r1';
const runs = readFileSync(join(dir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tasks = JSON.parse(readFileSync('fixtures/tasks.json', 'utf8'));
const titleOf = (id) => { const t = tasks.find((x) => x.id === id); const p = t?.prompt ?? id; return p.split(/[.:]/)[0].slice(0, 80); };
const trace = (r) => {
  const wd = existsSync(r.workdir) ? r.workdir : join(dir, 'work', r.workdir.split('/work/').pop());
  const sdir = join(wd, '.headstart', 'sessions'); if (!existsSync(sdir)) return null;
  let events = [];
  for (const f of readdirSync(sdir)) { const evs = readFileSync(join(sdir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); if (evs.length > events.length) events = evs; }
  const t0 = events[0]?.ts ?? 0;
  const short = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v ?? ''); return s.replace(wd + '/', '').replace(/\/Users\/[^ "']*\/work\/[^/]+\//g, '').slice(0, 110); };
  const steps = events.filter((e) => e.event === 'tool').map((e) => {
    const i = e.tool_input ?? {};
    const text = i.command ?? i.cmd ?? i.file_path ?? i.path ?? i.pattern ?? i.query ?? short(i);
    return { at: Math.round((e.ts - t0) / 100) / 10, tool: e.tool_name, text: short(text), ok: e.ok !== false };
  });
  const handed = events.find((e) => e.event === 'recall')?.ids?.length ?? 0;
  return { steps, handed };
};
const out = [];
for (const task of [...new Set(runs.map((r) => r.task))]) {
  const cold = runs.find((r) => r.task === task && r.arm === 'cold' && !r.error && r.repeat == 1) ?? runs.find((r) => r.task === task && r.arm === 'cold' && !r.error);
  const warm = runs.find((r) => r.task === task && r.arm === 'full' && !r.error && r.repeat == 1) ?? runs.find((r) => r.task === task && r.arm === 'full' && !r.error);
  if (!cold || !warm) continue;
  const side = (r) => { const t = trace(r); if (!t) return null; return { session: r.session_id, tokens: (r.input_tokens ?? 0) + (r.cache_read ?? 0) + (r.cache_create ?? 0) + (r.output_tokens ?? 0), seconds: r.duration_s, toolCalls: r.tool_calls, turns: r.turns, pass: !!r.pass, steps: t.steps }; };
  const c = side(cold), w = side(warm); if (!c || !w) continue;
  out.push({ task, title: titleOf(task), cold: c, warm: w });
}
out.sort((a, b) => (b.cold.tokens - b.warm.tokens) - (a.cold.tokens - a.warm.tokens));
const meta = { source: basename(dir), runner: runs[0]?.runner, model: runs[0]?.model, pairs: out.length };
console.log(JSON.stringify({ ...meta, tasks: out.map((p) => `${p.task}: ${p.cold.toolCalls}->${p.warm.toolCalls} calls, ${Math.round((p.cold.tokens - p.warm.tokens) / 1000)}k tokens, ${p.cold.seconds}->${p.warm.seconds}s`) }, null, 1));
process.stdout.write('');
import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[3] || 'results/devin-pairs.json', JSON.stringify({ ...meta, pairs: out }));
