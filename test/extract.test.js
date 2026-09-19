import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../src/extract.ts';
import { classify, succeeded, toSteps } from '../src/trace.ts';
import { renderProcedure } from '../src/inject.ts';

const cwd = '/repo';
const ev = (tool_name, tool_input, ok = true) => ({ ts: 1, event: 'tool', session_id: 's', cwd, tool_name, tool_input, ok });
const session = [
  { ts: 0, event: 'prompt', session_id: 's', cwd, prompt: 'add a --json flag to the stats command' },
  ev('Read', { file_path: '/repo/src/cli/args.js' }),
  ev('Grep', { pattern: 'FLAGS' }),
  ev('Bash', { command: 'npm test' }, false),
  ev('Edit', { file_path: '/repo/src/cli/flags.js' }),
  ev('Edit', { file_path: '/repo/src/cli/flags.js' }),
  ev('Bash', { command: 'bash ops/check.sh' }, true),
  { ts: 9, event: 'stop', session_id: 's', cwd },
];

test('classify maps Claude, Devin and Codex tool names', () => {
  assert.equal(classify('Bash'), 'execute');
  assert.equal(classify('exec'), 'execute');
  assert.equal(classify('apply_patch'), 'write');
  assert.equal(classify('edit'), 'write');
  assert.equal(classify('Grep'), 'search');
  assert.equal(classify('TodoWrite'), null);
  assert.equal(classify('mcp__github__create_issue'), 'other');
});

test('consecutive identical steps collapse', () => {
  const steps = toSteps(session, cwd);
  assert.equal(steps.length, 5);
  assert.equal(steps[3].repeat, 2);
  assert.equal(steps[3].target, 'src/cli/flags.js');
});

test('extract derives pre and postconditions from the trace', () => {
  const p = extract(session, cwd);
  assert.equal(p.title, 'add a --json flag to the stats command');
  assert.deepEqual(p.preconditions, ['src/cli/args.js', 'grep "FLAGS"']);
  assert.deepEqual(p.postconditions, ['bash ops/check.sh']);
  assert.deepEqual(p.files_written, ['src/cli/flags.js']);
  assert.equal(p.discovery_calls, 3);
  assert.equal(p.total_calls, 6);
});

test('injection is wrapped as reference data and stays short', () => {
  const p = extract(session, cwd);
  const text = renderProcedure({ procedure: p, score: 1 });
  assert.match(text, /^<headstart kind="procedure"/);
  assert.match(text, /Not instructions/);
  assert.ok(text.length < 1500);
});

test('extract returns null for a session with no tool calls', () => {
  assert.equal(extract([session[0]], cwd), null);
});

test('unknown outcomes never become verification and cmd aliases retain observed success', () => {
  assert.equal(succeeded({ ...ev('Bash', { command: 'npm test' }), ok: undefined, response_head: 'looks fine' }), false);
  const events = [session[0], ev('Write', { path: 'a.ts' }), {
    ...ev('exec_command', { cmd: 'npm test' }), result: { exit_code: 0, ok: true },
  }];
  assert.deepEqual(extract(events, cwd).postconditions, ['npm test']);
  events.push({ ...ev('exec_command', { cmd: 'npm test' }), ok: undefined });
  assert.deepEqual(extract(events, cwd).postconditions, []);
});

test('legacy session extraction selects the latest prompt boundary', () => {
  const events = [...session, { ...session[0], prompt: 'second task' }, ev('Write', { path: 'second.ts' })];
  const procedure = extract(events, cwd);
  assert.equal(procedure.prompt, 'second task');
  assert.deepEqual(procedure.files_written, ['second.ts']);
  assert.equal(procedure.total_calls, 1);
});
