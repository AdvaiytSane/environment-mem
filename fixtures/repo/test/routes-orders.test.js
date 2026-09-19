import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

test('GET /orders/:id returns a single order', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/orders/o3');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.order.userId, 'u2');
  } finally {
    server.close();
  }
});

test('an unregistered path returns 404', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/does/not/exist');
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
