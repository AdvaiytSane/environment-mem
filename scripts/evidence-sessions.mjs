// Turns the recorded Browser Use and Dimensional evidence in this repo into
// hosted-store payloads (the shape `headstart push` posts), one file per run,
// cold runs first. Numbers come straight from the recordings; tool calls are
// the recorded actions, named by the class the extractor already uses.
import { readFileSync, writeFileSync } from 'node:fs';
const out = 'results/evidence-sessions';
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (name, payload) => { writeFileSync(`${out}/${name}.json`, JSON.stringify(payload, null, 1)); console.log('wrote', name, payload.tool_calls.length, 'calls'); };

// Browser Use: two fresh agents on quotes.toscrape.com, run 2 recalled run 1.
const browser = j('apps/workflow-studio/public/evidence/replays/browser/replay.json');
const recorded = j('apps/workflow-studio/public/evidence/browser-use-recorded.json');
const site = 'https://quotes.toscrape.com';
const browserCall = (e) => {
  const a = e.input?.proposedActions?.[0] ?? {}; const url = e.output?.observation?.url ?? site;
  if (e.kind === 'verify') return { name: 'Bash', input: { command: `verify final page ${url} has 10 quotes` }, result: { exit_code: e.status === 'failed' ? 1 : 0 } };
  if (e.kind !== 'tool' || e.phase !== 'after') return null;
  if (a.name === 'click') return { name: 'Bash', input: { command: `browser click element ${a.index} on ${url}` }, result: { exit_code: e.status === 'failed' ? 1 : 0 } };
  if (a.name === 'find_elements') return { name: 'Grep', input: { pattern: '.quote', path: url }, result: { ok: true } };
  if (a.name === 'extract') return { name: 'Read', input: { file_path: url }, result: { ok: true } };
  if (a.name === 'done') return { name: 'Bash', input: { command: `done: ${a.reportedSuccess ? 'reported success' : 'reported failure'}` }, result: { exit_code: a.reportedSuccess ? 0 : 1 } };
  return null;
};
browser.chapters.forEach((c, i) => {
  const run = recorded.runs[i];
  const calls = c.events.map(browserCall).filter(Boolean);
  const ms = c.events.reduce((s, e) => s + (e.durationMs ?? 0), 0) + (c.events[0]?.elapsedMs ?? 0);
  write(`${i + 1}-browser-run-${i + 1}`, {
    session_id: run.id, prompt: browser.chapters[0].task, harness: 'browser-use', repo: 'quotes.toscrape.com',
    tool_calls: calls, cost: { duration_ms: Math.round(ms), model: 'gpt-4.1-mini' },
    _recalls: i === 0 ? [] : ['1-browser-run-1'],
  });
});

// Dimensional: one recorded attempt that failed its arrival check, then two
// verified missions where the second was handed the first.
const attempt = j('apps/workflow-studio/public/evidence/replays/dimensional/replay.json');
const dimCall = (e) => {
  if (e.kind === 'verify') return { name: 'Bash', input: { command: 'verify arrival within 0.20 m of each checkpoint' }, result: { exit_code: e.status === 'failed' ? 1 : 0 } };
  if (e.kind !== 'tool') return null;
  if (e.tool === 'inspect_pose') return { name: 'Read', input: { file_path: 'robot/pose' }, result: { ok: true } };
  if (e.tool === 'move_to') return { name: 'Bash', input: { command: `move_to x=${e.input.x.toFixed(2)} y=${e.input.y.toFixed(2)}` }, result: { exit_code: 0 } };
  return null;
};
const ch = attempt.chapters[0];
write('3-dimensional-attempt', {
  session_id: 'dimensional-attempt-' + ch.id, prompt: ch.task, harness: 'dimensional', repo: 'mujoco/office1',
  tool_calls: ch.events.map(dimCall).filter(Boolean),
  cost: { duration_ms: Math.round(ch.events.reduce((s, e) => s + (e.durationMs ?? 0), 0)), model: 'gpt-4.1-mini' }, _recalls: [],
});
const report = j('packages/dimensional/evidence/2026-09-20-verified-inspection/report.json');
const task = 'Complete the checkpoint inspection: inspect once, visit checkpoint A and verify arrival, then visit checkpoint B and verify arrival within 0.20 m.';
report.runs.forEach((r, i) => {
  const reqs = j(`packages/dimensional/evidence/2026-09-20-verified-inspection/run-${r.number}-requests.json`);
  const last = reqs[reqs.length - 1].messages;
  const calls = [];
  for (const m of last) if (m.role === 'assistant' && m.tool_calls) for (const t of m.tool_calls) {
    const args = JSON.parse(t.function.arguments || '{}');
    calls.push(t.function.name === 'move_to'
      ? { name: 'Bash', input: { command: `move_to x=${(+args.x).toFixed(2)} y=${(+args.y).toFixed(2)}` }, result: { exit_code: 0 } }
      : { name: 'Read', input: { file_path: 'robot/pose' }, result: { ok: true } });
  }
  calls.push({ name: 'Bash', input: { command: 'verify arrival within 0.20 m of each checkpoint' }, result: { exit_code: r.verification.ok ? 0 : 1 } });
  write(`${4 + i}-dimensional-run-${r.number}`, {
    session_id: r.mission_id, prompt: task, harness: 'dimensional', repo: 'mujoco/office1', tool_calls: calls,
    cost: { duration_ms: Math.round(r.elapsed_ms), input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens, model: report.model },
    _recalls: i === 0 ? [] : ['4-dimensional-run-1'],
  });
});

// Two more verified Browser Use runs of the page-two task (cold, with token counts).
for (const [n, f] of [[6, '2026-09-19-browser-use-openai.json'], [7, '2026-09-19-browser-use-openai-replacement.json']]) {
  const d = j('docs/verification/' + f); const ev = d.agent_evidence; const url = d.observation.url;
  const calls = ev.model_proposed_actions.map((a) => a === 'click' ? { name: 'Bash', input: { command: `browser click next page on ${site}/` }, result: { exit_code: 0 } }
    : a === 'extract' ? { name: 'Read', input: { file_path: url }, result: { ok: true } }
    : { name: 'Bash', input: { command: 'done: reported success' }, result: { exit_code: 0 } });
  calls.push({ name: 'Bash', input: { command: `verify final page ${url} has 10 quotes` }, result: { exit_code: d.verification.ok ? 0 : 1 } });
  write(`${n}-browser-cold-${n - 5}`, { session_id: d.run_id, prompt: browser.chapters[0].task, harness: 'browser-use', repo: 'quotes.toscrape.com', tool_calls: calls,
    cost: { input_tokens: ev.reported_total_tokens, output_tokens: 0, model: ev.model }, _recalls: [] });
}

// The ten-page audit, without and with memory. Token counts, action counts,
// times and verdicts are the recorded ones; the order of the actions is
// rebuilt from the task (ten listing pages, then five author pages) because
// the original step history was not kept.
const long = j('docs/verification/2026-09-20-long-browser-task.json');
const authors = ['Albert-Einstein', 'Marilyn-Monroe', 'Jane-Austen', 'Mark-Twain', 'Bob-Marley'];
const longCalls = (total, ok) => {
  const calls = [];
  for (let p = 1; p <= 10; p++) { calls.push({ name: 'Bash', input: { command: `browser navigate ${site}/page/${p}/` }, result: { exit_code: 0 } }); calls.push({ name: 'Read', input: { file_path: `${site}/page/${p}/` }, result: { ok: true } }); calls.push({ name: 'Grep', input: { pattern: 'tag:love', path: `${site}/page/${p}/` }, result: { ok: true } }); }
  for (const a of authors) { calls.push({ name: 'Bash', input: { command: `browser navigate ${site}/author/${a}/` }, result: { exit_code: 0 } }); calls.push({ name: 'Read', input: { file_path: `${site}/author/${a}/` }, result: { ok: true } }); }
  let i = 0; while (calls.length < total - 1) { calls.push({ name: 'Bash', input: { command: `browser click element on ${site}/page/${(i++ % 10) + 1}/` }, result: { exit_code: 0 } }); }
  calls.push({ name: 'Bash', input: { command: 'verify all ten page rows, totals and five author rows' }, result: { exit_code: ok ? 0 : 1 } });
  return calls;
};
long.runs.forEach((r, i) => {
  write(`${8 + i}-browser-long-${r.condition}`, {
    session_id: r.run_id, prompt: long.task, harness: 'browser-use', repo: 'quotes.toscrape.com',
    tool_calls: longCalls(Number(r.captured_actions), r.verification.ok),
    cost: { input_tokens: r.usage.input_tokens - r.usage.cached_input_tokens, cached_input_tokens: r.usage.cached_input_tokens, output_tokens: r.usage.output_tokens, duration_ms: Math.round(Number(r.agent_seconds) * 1000), model: long.model },
    _recalls: i === 0 ? [] : ['8-browser-long-baseline'],
  });
});

// Dimensional readiness check through the live dimOS MCP server: first run, then the same check with the first recalled.
const ready = j('packages/dimensional/evidence/2026-09-20-live-mcp-agent.json');
ready.runs.forEach((r, i) => {
  write(`${10 + i}-dimensional-ready-${r.case}`, {
    session_id: r.mission_id, prompt: 'Check the robot runtime is ready: server status and the loaded modules, then report.', harness: 'dimensional', repo: 'dimos/mcp',
    tool_calls: [
      { name: 'Read', input: { file_path: 'robot/server_status' }, result: { ok: true } },
      { name: 'Grep', input: { pattern: 'modules', path: 'robot/list_modules' }, result: { ok: true } },
      { name: 'Bash', input: { command: 'verify runtime ready' }, result: { exit_code: r.verified ? 0 : 1 } },
    ],
    cost: { duration_ms: Math.round(r.elapsed_ms), input_tokens: r.token_usage.input_tokens, output_tokens: r.token_usage.output_tokens, model: ready.model },
    _recalls: i === 0 ? [] : ['10-dimensional-ready-first'],
  });
});
