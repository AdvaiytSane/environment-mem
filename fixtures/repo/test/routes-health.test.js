import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

test('GET /health reports ok', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});
