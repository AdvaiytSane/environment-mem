import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runEvents } from '../src/hook.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'headstart-capture-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const state = join(cwd, 'state');
  const store = join(state, 'procedures.jsonl');
  const env = { ...process.env, HEADSTART_STATE_DIR: state, HEADSTART_STORE: store,
    HEADSTART_INJECT: '0', HEADSTART_RECORD: '1', HEADSTART_BACKEND: 'local' };
  const hook = (event, input = {}, overrides = {}) => {
    const result = spawnSync(process.execPath, [cli, 'hook', event], {
      cwd, env: { ...env, ...overrides }, input: JSON.stringify({ cwd, session_id: 'session-a', ...input }), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result;
  };
  const journal = () => readdirSync(join(state, 'sessions'))
    .flatMap(file => readFileSync(join(state, 'sessions', file), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
  const stored = () => existsSync(store) ? readFileSync(store, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  return { cwd, state, store, hook, journal, stored };
}

test('two real local shell runs retain independent prompts, results, and procedures', t => {
  const f = fixture(t);
  const ledger = [];
  for (const [index, exitCode] of [7, 0].entries()) {
    f.hook('UserPromptSubmit', { prompt: `run task ${index}` });
    // These processes actually run; their OS exit status is independent of
    // the hook parser. This is a generic-loop check, not a native agent test.
    const command = `printf 'task ${index}'; exit ${exitCode}`;
    const result = spawnSync('sh', ['-c', command], { cwd: f.cwd, encoding: 'utf8' });
    ledger.push(result.status);
    f.hook('PostToolUse', { tool_call_id: `command-${index}`, tool_name: 'exec_command',
      tool_input: { cmd: command }, tool_response: { exit_code: result.status, stdout: result.stdout } });
    f.hook('Stop');
  }
  const procedures = f.stored();
  assert.equal(procedures.length, 2);
  assert.notEqual(procedures[0].run_id, procedures[1].run_id);
  assert.notEqual(procedures[0].id, procedures[1].id);
  assert.deepEqual(procedures.map(p => p.prompt), ['run task 0', 'run task 1']);
  assert.deepEqual(procedures.map(p => p.total_calls), [1, 1]);
  const calls = f.journal().filter(e => e.event === 'tool');
  assert.deepEqual(calls.map(e => e.result.exit_code), ledger);
  assert.deepEqual(calls.map(e => e.result.ok), [false, true]);
});

test('duplicate tool delivery and repeated stop do not create another call or store revision', t => {
  const f = fixture(t);
  f.hook('UserPromptSubmit', { prompt: 'inspect a file', turn_id: 'turn-a' });
  const call = { tool_use_id: 'call-a', tool_name: 'Read', tool_input: { file_path: 'a.ts' }, tool_response: { ok: true } };
  f.hook('PostToolUse', call);
  f.hook('PostToolUse', call);
  f.hook('Stop');
  const after = readFileSync(f.store, 'utf8');
  f.hook('Stop');
  f.hook('SessionEnd');
  assert.equal(readFileSync(f.store, 'utf8'), after);
  assert.equal(f.journal().filter(e => e.event === 'tool').length, 1);
  assert.equal(f.journal().filter(e => e.event === 'stop').length, 1);
  assert.equal(f.stored()[0].total_calls, 1);
});

test('an observed result can refine an unknown tool call without creating a second step', t => {
  const f = fixture(t);
  f.hook('UserPromptSubmit', { prompt: 'run a command', run_id: 'turn-a' });
  const call = { tool_call_id: 'call-a', tool_name: 'exec_command', tool_input: { cmd: 'npm test' } };
  f.hook('PostToolUse', call);
  f.hook('PostToolUse', { ...call, tool_response: { exit_code: 2 } });
  f.hook('Stop');
  const calls = runEvents(f.journal(), 'turn-a').filter(e => e.event === 'tool');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].result, { exit_code: 2, ok: false });
  assert.equal(f.stored()[0].total_calls, 1);
});

test('recording disabled prevents all journal and procedure writes', t => {
  const f = fixture(t);
  for (const event of ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'SessionEnd']) {
    f.hook(event, { prompt: 'private prompt', tool_input: { content: 'private value' } }, { HEADSTART_RECORD: '0' });
  }
  assert.equal(existsSync(join(f.state, 'sessions')), false);
  assert.equal(existsSync(f.store), false);
});

test('failed-tool hook marks failure; an unstructured response stays unknown', t => {
  const f = fixture(t);
  f.hook('UserPromptSubmit', { prompt: 'check a command' });
  f.hook('PostToolUseFailure', { tool_name: 'Bash', tool_input: { command: 'npm test' }, error: 'failed' });
  f.hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: 'some output' });
  f.hook('Stop');
  const [failed, unknown] = f.journal().filter(e => e.event === 'tool');
  assert.deepEqual(failed.result, { ok: false });
  assert.equal(unknown.result, undefined);
  assert.equal(unknown.ok, undefined);
  assert.deepEqual(f.stored()[0].postconditions, []);
});

test('per-run persistence retains multiple tasks from one session and latest revisions', async t => {
  const f = fixture(t);
  const { readAll } = await import('../src/store.ts');
  const before = process.env.HEADSTART_STORE;
  process.env.HEADSTART_STORE = f.store;
  t.after(() => before === undefined ? delete process.env.HEADSTART_STORE : process.env.HEADSTART_STORE = before);
  for (const run of ['one', 'two']) {
    f.hook('UserPromptSubmit', { prompt: `task ${run}`, run_id: run });
    f.hook('PostToolUse', { tool_name: 'Read', tool_input: { path: `${run}.ts` } });
    f.hook('Stop');
  }
  assert.deepEqual(readAll(f.cwd).map(p => p.run_id), ['one', 'two']);
  f.hook('PostToolUse', { run_id: 'two', tool_name: 'Read', tool_input: { path: 'another.ts' } });
  f.hook('Stop', { run_id: 'two' });
  assert.equal(readAll(f.cwd).length, 2);
  assert.equal(readAll(f.cwd)[1].total_calls, 2);
});
