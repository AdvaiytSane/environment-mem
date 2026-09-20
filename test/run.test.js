import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runOne, loadTasks } from '../src/run.ts';

// Process-lifecycle regressions only. These fixtures are not Devin runs and
// provide no evidence of model quality, capture fidelity, or memory benefit.
async function withRunner(script, body) {
  const root = mkdtempSync(join(tmpdir(), 'headstart-runner-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  if (script) { const file = join(bin, 'devin'); writeFileSync(file, `#!/bin/sh\n${script}\n`); chmodSync(file, 0o700); }
  const names = ['PATH', 'HEADSTART_API_KEY', 'HEADSTART_API_URL'];
  const previous = Object.fromEntries(names.map(k => [k, process.env[k]]));
  process.env.PATH = `${bin}:/usr/bin:/bin`;
  delete process.env.HEADSTART_API_KEY; delete process.env.HEADSTART_API_URL;
  try {
    await body({ live: join(root, 'live'), store: join(root, 'store.jsonl'), repo: resolve('fixtures/repo'), tasks: loadTasks() });
  } finally {
    for (const k of names) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; }
    rmSync(root, { recursive: true, force: true });
  }
}

test('missing executable returns a controlled failure and preserves unknown usage', async () => {
  await withRunner(null, async opts => {
    const r = await runOne({ lane: 'missing', agent: 'devin', task: 'bugfix-1', inject: '0' }, opts);
    assert.match(r.error, /not installed or is not on PATH/);
    assert.equal(r.verification.status, 'not_run');
    assert.equal(r.cost.input_tokens, undefined);
    assert.equal(r.stored, false);
    const saved = JSON.parse(readFileSync(join(opts.live, 'missing/.headstart/run-result.json'), 'utf8'));
    assert.equal(saved.error, r.error);
  });
});

test('signal termination is a failed run even when exit code is null', async () => {
  await withRunner('kill -TERM $$', async opts => {
    const r = await runOne({ lane: 'signal', agent: 'devin', task: 'bugfix-1', inject: '0' }, opts);
    assert.match(r.error, /terminated by SIGTERM/);
    assert.equal(r.verification.status, 'not_run');
  });
});

test('time limit is reported as a failure', async () => {
  await withRunner('exec /bin/sleep 5', async opts => {
    const r = await runOne({ lane: 'timeout', agent: 'devin', task: 'bugfix-1', inject: '0', timeoutMin: 0.001 }, opts);
    assert.match(r.error, /timed out after 60ms/);
    assert.equal(r.verification.status, 'not_run');
  });
});

test('exit zero without a fixture fix fails independent verification', async () => {
  await withRunner('exit 0', async opts => {
    const r = await runOne({ lane: 'unfixed', agent: 'devin', task: 'bugfix-1', inject: '0' }, opts);
    assert.equal(r.verification.status, 'failed', readFileSync(join(opts.live, 'unfixed/.headstart/verification.log'), 'utf8'));
    assert.match(r.error, /independent fixture check failed/);
    assert.equal(r.cost.dollars, undefined);
  });
});
