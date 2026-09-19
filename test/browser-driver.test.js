import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdapter } from '../packages/browser-use/memorable_browser_use/driver.mjs';

// Real loopback HTTP, deliberately fake credentials. These are protocol
// regressions, not evidence of production service availability or storage.
const origin = 'https://catalog.example.test';
const trace = () => ({ run: { origin, run_id: 'protocol-run' }, events: [{ id: 'first' }, { id: 'second' }], final: true });
const context = () => ({ signal: new AbortController().signal });

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'environment-mem-browser-http-'));
  const old = Object.fromEntries(['MEMORABLE_HOME', 'MEMORABLE_API_KEY', 'MEMORABLE_API_URL'].map(key => [key, process.env[key]]));
  process.env.MEMORABLE_HOME = dir;
  delete process.env.MEMORABLE_API_KEY;
  delete process.env.MEMORABLE_API_URL;
  const calls = [];
  let reply = { status: 200, body: { decision: 'no_match' } };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    calls.push({ method: request.method, path: request.url, headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    response.end(reply.raw ?? JSON.stringify(reply.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  mkdirSync(join(dir, '.memorable'));
  const writeConfig = config => writeFileSync(join(dir, '.memorable', 'config.json'), JSON.stringify(config));
  writeConfig({ api_key: 'test-only-browser-key', api_url: `${url}/ignored-prefix` });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    url, calls, writeConfig,
    respond: next => { reply = next; },
    adapter: options => createAdapter({ allowedOrigins: [origin], ...options }),
  };
}

test('browser driver uses the isolated config and documented resolve/ingest routes', async t => {
  const f = await fixture(t);
  const adapter = f.adapter();
  const request = { origin, task: 'Find a product', metadata: { test: true } };
  assert.deepEqual(await adapter.recall(request, context()), { decision: 'no_match' });
  f.respond({ status: 200, body: { accepted: 1, duplicates: 1, rejected: 0, run_state: 'final' } });
  const receipt = await adapter.store(trace(), context());
  assert.equal(receipt.duplicates, 1);
  assert.deepEqual(f.calls.map(call => call.path), ['/v1/browser/resolve', '/v1/browser/ingest']);
  assert.ok(f.calls.every(call => call.method === 'POST'));
  assert.ok(f.calls.every(call => call.headers.authorization === 'Bearer test-only-browser-key'));
  assert.ok(f.calls.every(call => call.headers['content-type'] === 'application/json'));
  assert.deepEqual(f.calls[0].body, request);
  assert.deepEqual(f.calls[1].body, trace());
  assert.ok(f.calls.every(call => !JSON.stringify(call.body).includes('test-only-browser-key')));
});

test('explicit endpoint and environment credential override isolated file configuration', async t => {
  const f = await fixture(t);
  f.writeConfig({ api_key: 'unused-file-key', api_url: 'http://127.0.0.1:1' });
  process.env.MEMORABLE_API_KEY = 'test-only-env-key';
  process.env.MEMORABLE_API_URL = 'http://127.0.0.1:2';
  await f.adapter({ apiUrl: f.url }).recall({ origin }, context());
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.authorization, 'Bearer test-only-env-key');
});

test('origin and endpoint validation reject requests before any network activity', async t => {
  const f = await fixture(t);
  for (const allowedOrigins of [undefined, [], ['https://catalog.example.test/path'], ['*'], ['file:///tmp']]) {
    assert.throws(() => createAdapter({ allowedOrigins }), { code: 'invalid_config' });
  }
  const adapter = f.adapter();
  await assert.rejects(adapter.recall({ origin: 'https://other.example.test' }, context()), { code: 'origin_not_allowed' });
  await assert.rejects(adapter.store({ ...trace(), run: { origin: 'https://other.example.test' } }, context()), { code: 'origin_not_allowed' });
  await assert.rejects(adapter.recall({ origin, state: { origin: 'https://other.example.test' } }, context()), { code: 'origin_not_allowed' });
  await assert.rejects(adapter.store({ ...trace(), events: [{ origin, after: { origin: 'https://other.example.test' } }] }, context()), { code: 'origin_not_allowed' });
  await assert.rejects(adapter.store({ ...trace(), events: Array.from({ length: 1001 }, () => ({})) }, context()), { code: 'invalid_request' });
  for (const apiUrl of ['http://not-loopback.example.test', `${f.url}?token=x`, `${f.url}#fragment`, 'https://user:password@example.test', 'file:///tmp/service']) {
    await assert.rejects(f.adapter({ apiUrl }).recall({ origin }, context()), { code: 'invalid_endpoint' });
  }
  assert.equal(f.calls.length, 0);
});

test('authorization failures retain machine-readable codes and required scope', async t => {
  const f = await fixture(t);
  f.respond({ status: 401, body: { error: 'unauthorized' } });
  await assert.rejects(f.adapter().recall({ origin }, context()), error => error.code === 'unauthorized' && /HTTP 401/.test(error.message));
  f.respond({ status: 403, body: { error: 'missing_scope', required_scope: 'browser:write' } });
  await assert.rejects(f.adapter().store(trace(), context()), error => error.code === 'missing_scope' && /HTTP 403; requires browser:write/.test(error.message));
  f.writeConfig({ api_url: f.url });
  await assert.rejects(f.adapter().recall({ origin }, context()), { code: 'credentials_missing' });
  assert.equal(f.calls.length, 2, 'missing credentials should not create an unauthenticated HTTP call');
});

test('a no_match response is distinct from service outages and malformed responses', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.adapter().recall({ origin }, context()), { decision: 'no_match' });
  f.respond({ status: 503, body: { error: 'unavailable', decision: 'no_match' } });
  await assert.rejects(f.adapter().recall({ origin }, context()), error => error.code === 'unavailable' && /HTTP 503/.test(error.message));
  f.respond({ status: 200, body: { decision: 'unexpected' } });
  await assert.rejects(f.adapter().recall({ origin }, context()), { code: 'invalid_response' });
  f.respond({ status: 200, raw: '<html>bad gateway</html>' });
  await assert.rejects(f.adapter().recall({ origin }, context()), { code: 'invalid_response' });
});

test('store accepts only a complete batch acknowledgment with a valid final state', async t => {
  const f = await fixture(t);
  const base = { accepted: 2, duplicates: 0, rejected: 0, run_state: 'final' };
  const invalid = [
    [{ ...base, rejected: 1 }, 'partial_ingest'],
    [{ ...base, run_state: 'truncated' }, 'partial_ingest'],
    [{ ...base, accepted: 1 }, 'partial_ingest'],
    [{ ...base, accepted: 3 }, 'partial_ingest'],
    [{ ...base, run_state: 'open' }, 'partial_ingest'],
    [{ ...base, accepted: '2' }, 'invalid_receipt'],
    [{ ...base, duplicates: -1 }, 'invalid_receipt'],
    [{ ...base, accepted: Number.MAX_SAFE_INTEGER + 1 }, 'invalid_receipt'],
    [{ ...base, rejected: null }, 'invalid_receipt'],
    [{ accepted: 2 }, 'invalid_receipt'],
  ];
  for (const [body, code] of invalid) {
    f.respond({ status: 200, body });
    await assert.rejects(f.adapter().store(trace(), context()), { code }, JSON.stringify(body));
  }
  for (const body of [base, { ...base, accepted: 0, duplicates: 2 }]) {
    f.respond({ status: 200, body });
    assert.deepEqual(await f.adapter().store(trace(), context()), body);
  }
});

test('offline mode never submits a request even when credentials are available', async t => {
  const f = await fixture(t);
  const adapter = f.adapter({ offline: true });
  await assert.rejects(adapter.recall({ origin }, context()), { code: 'offline' });
  await assert.rejects(adapter.store(trace(), context()), { code: 'offline' });
  assert.equal(f.calls.length, 0);
});

test('redirects never forward the bearer credential to a redirected route', async t => {
  const f = await fixture(t);
  f.respond({ status: 307, body: {}, headers: { location: `${f.url}/credential-leak` } });
  await assert.rejects(f.adapter().recall({ origin }, context()), { code: 'network_error' });
  assert.deepEqual(f.calls.map(call => call.path), ['/v1/browser/resolve']);
});

test('oversized service responses are rejected without returning a partial JSON result', async t => {
  const f = await fixture(t);
  f.respond({ status: 200, body: { decision: 'no_match', extra: 'x'.repeat(1_900_001) } });
  await assert.rejects(f.adapter().recall({ origin }, context()), { code: 'response_too_large' });
});
