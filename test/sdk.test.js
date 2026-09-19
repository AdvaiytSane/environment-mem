import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemorable, MemorableCommandError } from 'headstart/memorable';

// Transport contract tests use a deliberately small subprocess fixture.
// They are not evidence of a deployed backend or native-agent integration.
function fixture(t, source) {
  const dir = mkdtempSync(join(tmpdir(), 'environment-mem-sdk-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const script = join(dir, 'cli.mjs');
  writeFileSync(script, source);
  return { dir, client: createMemorable({ command: process.execPath, args: [script], cwd: dir }) };
}

const trace = {
  session_id: 'session-1', workflow_id: 'turn-1', task_description: 'Fix retry handling', harness: 'custom',
  tool_calls: [
    { name: 'exec', input: { command: 'node --test' }, result: { ok: false, exit_code: 7 } },
    { name: 'update_file', input: { path: 'retry.ts' } },
  ],
};

test('store preserves real outcomes and sends the documented envelope over stdin', async t => {
  const { client } = fixture(t, `
    let input = ''; for await (const c of process.stdin) input += c;
    process.stdout.write(JSON.stringify({args: process.argv.slice(2), input: JSON.parse(input)}));
  `);
  const result = await client.store(trace);
  const seen = JSON.parse(result.stdout);
  assert.deepEqual(seen.args, ['ingest', '-']);
  assert.deepEqual(seen.input, trace);
  assert.equal(seen.input.tool_calls[1].result, undefined);
  assert.equal(result.status, 'command_completed');
  assert.equal('stored' in result, false);
});

test('recall passes task text literally without shell expansion or invented JSON flags', async t => {
  const { client, dir } = fixture(t, `process.stdout.write(JSON.stringify(process.argv.slice(2)));`);
  const query = '--chain $(touch compromised); `touch compromised`';
  const result = await client.recall({ query, mode: 'single' });
  assert.deepEqual(JSON.parse(result.stdout), ['recall', '--single', ` ${query}`]);
  assert.equal(existsSync(join(dir, 'compromised')), false);
  const shown = await client.recall({ procedureId: 'procedures/a-fix' });
  assert.deepEqual(JSON.parse(shown.stdout), ['show', 'procedures/a-fix']);
});

test('a nonzero CLI exit is surfaced with its actual stderr', async t => {
  const { client } = fixture(t, `process.stderr.write('extraction refused'); process.exit(3);`);
  await assert.rejects(client.store(trace), e => e instanceof MemorableCommandError
    && e.code === 'exit_nonzero' && e.exitCode === 3 && e.stderr === 'extraction refused');
});

test('missing binaries, deadlines, cancellation, and excessive output remain distinct', async t => {
  const { dir } = fixture(t, '');
  await assert.rejects(createMemorable({ command: join(dir, 'missing') }).recall({ query: 'task' }), { code: 'spawn_failed' });
  const script = join(dir, 'slow.mjs');
  writeFileSync(script, 'setInterval(() => {}, 1000);');
  const slow = createMemorable({ command: process.execPath, args: [script], timeoutMs: 100 });
  await assert.rejects(slow.recall({ query: 'task' }), { code: 'timeout' });
  const controller = new AbortController();
  const pending = createMemorable({ command: process.execPath, args: [script] }).recall({ query: 'task' }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: 'aborted' });
  writeFileSync(script, `process.stdout.write('x'.repeat(10000));`);
  await assert.rejects(createMemorable({ command: process.execPath, args: [script], maxOutputBytes: 64 }).recall({ query: 'task' }), e => e.code === 'output_limit' && Buffer.byteLength(e.stdout) <= 64);
});

test('invalid traces and contradictory outcomes are refused before spawning', async () => {
  const client = createMemorable({ command: '/not/a/real/command' });
  await assert.rejects(client.store({ ...trace, tool_calls: [{ name: 'exec', input: {}, result: { ok: true, exit_code: 7 } }] }), /conflicts/);
  await assert.rejects(client.store({ ...trace, task_description: '' }), /task_description/);
  await assert.rejects(client.store({ ...trace, session_id: 'a/b' }), /session_id/);
  await assert.rejects(client.store({ ...trace, workflow_id: '-turn' }), /workflow_id/);
  await assert.rejects(client.recall({ query: 'task', procedureId: 'procedures/id' }), /cannot be combined/);
});

test('deadline is bounded when a descendant retains output pipes', async t => {
  const { dir } = fixture(t, '');
  const script = join(dir, 'parent.mjs');
  writeFileSync(script, `
    import {spawn} from 'node:child_process';
    spawn(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], {stdio: ['ignore', 'inherit', 'inherit']});
    setInterval(() => {}, 1000);
  `);
  const start = performance.now();
  const client = createMemorable({ command: process.execPath, args: [script], timeoutMs: 150 });
  await assert.rejects(client.recall({ query: 'task' }), { code: 'timeout' });
  assert.ok(performance.now() - start < 1200, 'deadline should not wait for the descendant to exit naturally');
});
