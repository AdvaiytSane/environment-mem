import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

test('configured Memorable backend routes actual events, retains failed submission, and retries', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'environment-mem-connection-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const stub = join(cwd, 'memorable.mjs');
  // This subprocess double checks transport/queue behavior only. It is not
  // described as production verification in docs/verification/.
  writeFileSync(stub, `
    import {appendFileSync, existsSync} from 'node:fs';
    if (process.argv[2] === 'ingest') {
      let input = ''; for await (const c of process.stdin) input += c;
      appendFileSync('received.jsonl', input + '\\n');
      if (!existsSync('allow')) { process.stderr.write('connection unavailable'); process.exit(1); }
      process.stdout.write('opaque CLI output');
    } else {
      process.stdout.write('REAL-CONNECTION-CANDIDATE');
    }
  `);
  const env = { ...process.env, HEADSTART_STATE_DIR: join(cwd, '.headstart'),
    HEADSTART_STORE: join(cwd, '.headstart', 'procedures.jsonl'), HEADSTART_HARNESS: 'claude-code',
    HEADSTART_MEMORABLE_BIN: process.execPath, HEADSTART_MEMORABLE_ARGS: JSON.stringify([stub]), HEADSTART_RECORD: '1', HEADSTART_INJECT: 'full' };
  delete env.HEADSTART_BACKEND;
  const run = (args, input) => spawnSync(process.execPath, [cli, ...args], {
    cwd, env, input: input && JSON.stringify({ cwd, session_id: 'session:a', ...input }), encoding: 'utf8',
  });
  assert.equal(run(['init', '--backend', 'memorable']).status, 0);
  const prompt = run(['hook', 'UserPromptSubmit'], { prompt: 'fix retry budget', run_id: 'turn:1' });
  assert.match(JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext, /REAL-CONNECTION-CANDIDATE/);
  for (const [id, response] of [['failure', { exit_code: 7 }], ['unknown', undefined]]) {
    assert.equal(run(['hook', 'PostToolUse'], { tool_call_id: id, tool_name: 'Bash',
      tool_input: { command: 'node --test' }, tool_response: response }).status, 0);
  }
  const stop = run(['hook', 'Stop'], {});
  assert.equal(stop.status, 0, 'optional forwarding failure must not fail the host stop');
  assert.match(stop.stderr, /capture retained/);
  assert.equal(JSON.parse(run(['connection']).stdout).pendingSubmissions, 1);
  const first = JSON.parse(readFileSync(join(cwd, 'received.jsonl'), 'utf8').trim());
  assert.equal(first.task_description, 'fix retry budget');
  assert.equal(first.harness, 'claude-code');
  assert.deepEqual(first.tool_calls.map(c => c.name), ['Bash', 'Bash']);
  assert.deepEqual(first.tool_calls[0].result, { exit_code: 7, ok: false });
  assert.equal(first.tool_calls[1].result, undefined);
  assert.match(first.workflow_id, /^env-[a-f0-9]+$/);
  writeFileSync(join(cwd, 'allow'), '');
  assert.equal(run(['sync']).status, 0);
  const deliveries = readFileSync(join(cwd, 'received.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(deliveries.length, 2);
  assert.deepEqual(deliveries[1], first, 'retry preserves the original task identity and outcomes');
  assert.equal(JSON.parse(run(['connection']).stdout).pendingSubmissions, 0);
  assert.equal(run(['sync']).status, 0);
  assert.equal(readFileSync(join(cwd, 'received.jsonl'), 'utf8').trim().split('\n').length, 2);
  assert.equal(run(['recall', 'retry']).stdout, 'REAL-CONNECTION-CANDIDATE');
  assert.equal(run(['recall', 'retry', '--json']).status, 1);
});

test('a refused older submission does not block later pending runs', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'environment-mem-queue-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const stub = join(cwd, 'memorable.mjs');
  writeFileSync(stub, `
    import {appendFileSync, existsSync} from 'node:fs';
    let input = ''; for await (const c of process.stdin) input += c;
    const trace = JSON.parse(input);
    appendFileSync('received.jsonl', input + '\\n');
    if (!existsSync('allow') || trace.task_description === 'refused task') process.exit(1);
    process.stdout.write('completed');
  `);
  const env = { ...process.env, HEADSTART_BACKEND: 'memorable', HEADSTART_RECORD: '1', HEADSTART_INJECT: 'off',
    HEADSTART_STATE_DIR: join(cwd, '.headstart'), HEADSTART_STORE: join(cwd, '.headstart', 'procedures.jsonl'),
    HEADSTART_MEMORABLE_BIN: process.execPath, HEADSTART_MEMORABLE_ARGS: JSON.stringify([stub]) };
  const run = (args, input) => spawnSync(process.execPath, [cli, ...args], {
    cwd, env, encoding: 'utf8', input: input && JSON.stringify({ cwd, session_id: 'session', ...input }),
  });
  for (const prompt of ['refused task', 'eligible task']) {
    assert.equal(run(['hook', 'UserPromptSubmit'], { prompt }).status, 0);
    assert.equal(run(['hook', 'PostToolUse'], { tool_name: 'Bash', tool_input: { command: 'node --test' }, tool_response: { exit_code: 0 } }).status, 0);
    assert.equal(run(['hook', 'Stop'], {}).status, 0);
  }
  assert.equal(JSON.parse(run(['connection']).stdout).pendingSubmissions, 2);
  writeFileSync(join(cwd, 'allow'), '');
  const synced = run(['sync']);
  assert.equal(synced.status, 1);
  assert.match(synced.stderr, /1 commands completed; 1 failed/);
  assert.equal(JSON.parse(run(['connection']).stdout).pendingSubmissions, 1);
  const delivered = readFileSync(join(cwd, 'received.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(delivered.map(trace => trace.task_description), ['refused task', 'eligible task', 'refused task', 'eligible task']);
});
