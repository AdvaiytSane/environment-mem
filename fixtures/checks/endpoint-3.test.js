import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

test('DELETE /orders/:id returns 204 for an existing order', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/orders/o10', { method: 'DELETE' });
    assert.equal(res.status, 204);
  } finally {
    server.close();
  }
});

test('DELETE /orders/:id returns 404 for an unknown order', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/orders/does-not-exist', { method: 'DELETE' });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
