import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';
import { DEPS } from '../src/lib/deps.js';

test('GET /health/deps returns ok and the configured deps', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/health/deps');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.deps, DEPS);
  } finally {
    server.close();
  }
});
