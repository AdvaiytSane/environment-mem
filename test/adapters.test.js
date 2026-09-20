import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { invokeAdapter, loadAdapter } from 'headstart/adapters';

// These exercise the optional-module protocol, not a browser or backend.
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

function fixture(t, source = '') {
  const dir = mkdtempSync(join(tmpdir(), 'environment-mem-adapter-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const modulePath = join(dir, 'selected adapter.mjs');
  writeFileSync(modulePath, source);
  const run = (args, body) => spawnSync(process.execPath, [cli, ...args], {
    cwd: dir,
    env: { ...process.env, HOME: dir, HEADSTART_BACKEND: 'local' },
    input: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    encoding: 'utf8', timeout: 10_000, maxBuffer: 12 * 1024 * 1024,
  });
  return { dir, modulePath, run };
}

function errorEnvelope(result, pattern) {
  assert.equal(result.error, undefined, 'the protocol process should terminate itself');
  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.schema, 'memorable.adapter.v1');
  assert.equal('result' in body, false);
  assert.match(body.error.message, pattern);
  return body;
}

test('CLI loads only the developer-selected local module and forwards request/config unchanged', t => {
  const { dir, modulePath, run } = fixture(t, `
    export function createAdapter(config) {
      return {
        async recall(request, {signal}) { return {method:'recall', request, config, aborted:signal.aborted}; },
        async store(request) { return {method:'store', request, config}; }
      };
    }
  `);
  const poison = join(dir, 'from-request.mjs');
  const marker = join(dir, 'unexpected-import');
  writeFileSync(poison, `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'loaded');`);
  const request = { adapter: poison, operation: 'store', trace: [{ custom: 'browser data' }], empty: null };
  const config = { adapter: poison, options: { site: 'example.test' } };
  const result = run(['memory', 'recall', '--adapter', modulePath], { request, config });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    schema: 'memorable.adapter.v1', operation: 'recall',
    result: { method: 'recall', request, config, aborted: false },
  });
  assert.equal(existsSync(marker), false, 'trace/config fields must not choose executable modules');
  const stored = run(['memory', 'store', '--adapter', './selected adapter.mjs'], { request });
  assert.equal(stored.status, 0, stored.stderr);
  assert.deepEqual(JSON.parse(stored.stdout), {
    schema: 'memorable.adapter.v1', operation: 'store', result: { method: 'store', request, config: {} },
  });
});

test('loader rejects remote modules and incomplete adapter contracts', async t => {
  const { dir, modulePath } = fixture(t, 'export const createAdapter = () => ({recall: async () => null});');
  for (const path of ['https://example.test/adapter.js', 'data:text/javascript,export default 1', 'node:fs']) {
    await assert.rejects(loadAdapter(path), /local module path/);
  }
  await assert.rejects(loadAdapter(dir), /local file/);
  await assert.rejects(loadAdapter(modulePath), /implement recall and store/);
  const missingFactory = join(dir, 'missing-factory.mjs');
  writeFileSync(missingFactory, 'export default {};');
  await assert.rejects(loadAdapter(missingFactory), /export createAdapter/);
});

test('CLI reports argument, JSON and configuration errors as nonzero JSON envelopes', t => {
  const { modulePath, run } = fixture(t, 'export const createAdapter = () => ({recall: async () => null, store: async () => null});');
  errorEnvelope(run(['memory', 'delete', '--adapter', modulePath], {}), /usage/);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath, '--extra'], {}), /usage/);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], '{'), /JSON|property|position|end/i);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], { config: {} }), /request/);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], { request: {}, config: [] }), /config must be an object/);
});

test('CLI operation failures remain errors rather than successful result objects', t => {
  const { modulePath, run } = fixture(t, `
    export const createAdapter = () => ({
      recall: async () => { throw new Error('credentials rejected'); },
      store: async () => { throw new Error('store unavailable'); }
    });
  `);
  const readError = errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], { request: {} }), /credentials rejected/);
  assert.equal(readError.operation, 'recall');
  const writeError = errorEnvelope(run(['memory', 'store', '--adapter', modulePath], { request: {} }), /store unavailable/);
  assert.equal(writeError.operation, 'store');
});

test('CLI bounds input before module loading and rejects excessive serialized output', t => {
  const { dir, modulePath, run } = fixture(t);
  const marker = join(dir, 'factory-ran');
  writeFileSync(modulePath, `
    import {writeFileSync} from 'node:fs';
    export function createAdapter() {
      writeFileSync(${JSON.stringify(marker)}, 'created');
      return { recall: async () => 'x'.repeat(2 * 1024 * 1024), store: async () => null };
    }
  `);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], { request: 'x'.repeat(8 * 1024 * 1024) }), /input exceeds/);
  assert.equal(existsSync(marker), false);
  errorEnvelope(run(['memory', 'recall', '--adapter', modulePath], { request: {} }), /output exceeds/);
  assert.equal(existsSync(marker), true);
});

test('a large adapter error cannot bypass the CLI output bound', t => {
  const { modulePath, run } = fixture(t, `
    export const createAdapter = () => ({
      recall: async () => { throw new Error('upstream refused: ' + 'x'.repeat(3 * 1024 * 1024)); },
      store: async () => null
    });
  `);
  const result = run(['memory', 'recall', '--adapter', modulePath], { request: {} });
  errorEnvelope(result, /upstream refused/);
  assert.ok(Buffer.byteLength(result.stdout) <= 2 * 1024 * 1024, 'JSON error responses must also remain bounded');
});

test('direct invocation dispatches the requested operation and normalizes absent results', async () => {
  const seen = [];
  const adapter = {
    async recall(request, context) { seen.push({ operation: 'recall', request, signal: context.signal }); },
    async store(request, context) { seen.push({ operation: 'store', request, signal: context.signal }); return { accepted: false }; },
  };
  assert.deepEqual(await invokeAdapter(adapter, 'recall', { query: 'task' }), {
    schema: 'memorable.adapter.v1', operation: 'recall', result: null,
  });
  assert.deepEqual(await invokeAdapter(adapter, 'store', ['arbitrary', 'trace']), {
    schema: 'memorable.adapter.v1', operation: 'store', result: { accepted: false },
  });
  assert.deepEqual(seen.map(({ operation, request }) => ({ operation, request })), [
    { operation: 'recall', request: { query: 'task' } }, { operation: 'store', request: ['arbitrary', 'trace'] },
  ]);
  assert.ok(seen.every(event => event.signal instanceof AbortSignal && !event.signal.aborted));
  for (const timeoutMs of [0, -1, Infinity, NaN, 120001]) {
    await assert.rejects(invokeAdapter(adapter, 'recall', {}, { timeoutMs }), /timeoutMs/);
  }
  await assert.rejects(invokeAdapter(adapter, 'erase', {}), /operation/);
  assert.equal(seen.length, 2, 'invalid invocation must not reach an adapter');
});

test('direct invocation times out and delivers cancellation to a pending adapter', async () => {
  let observedSignal;
  const adapter = {
    async recall(_request, { signal }) { observedSignal = signal; return new Promise(() => {}); },
    async store() {},
  };
  const started = performance.now();
  await assert.rejects(invokeAdapter(adapter, 'recall', {}, { timeoutMs: 25 }), /timed out/);
  assert.equal(observedSignal.aborted, true);
  assert.ok(performance.now() - started < 1000, 'a pending promise should not defeat the deadline');
});

test('deadline cannot become a successful response when an adapter resolves on abort', async () => {
  const adapter = {
    recall(_request, { signal }) {
      return new Promise(resolve => signal.addEventListener('abort', () => resolve({ cancelled: true }), { once: true }));
    },
    async store() {},
  };
  await assert.rejects(invokeAdapter(adapter, 'recall', {}, { timeoutMs: 25 }), /timed out/);
});

test('direct invocation enforces the same serialized output bound as the CLI', async () => {
  const adapter = { async recall() { return 'x'.repeat(2 * 1024 * 1024); }, async store() {} };
  await assert.rejects(invokeAdapter(adapter, 'recall', {}), /output exceeds/);
});

test('legacy CLI connection and local recall remain separate from optional adapters', t => {
  const { run } = fixture(t);
  const connection = run(['connection']);
  assert.equal(connection.status, 0, connection.stderr);
  const status = JSON.parse(connection.stdout);
  assert.equal(status.backend, 'local');
  assert.equal(status.transport, 'local');
  assert.equal('schema' in status, false);
  const recall = run(['recall', 'a task that has no stored procedure', '--json']);
  assert.equal(recall.status, 0, recall.stderr);
  assert.deepEqual(JSON.parse(recall.stdout), []);
});
