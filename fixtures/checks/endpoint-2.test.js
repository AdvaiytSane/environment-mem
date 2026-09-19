import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

test('GET /users/:id/summary returns order count and total spend', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/users/u4/summary');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, 'u4');
    assert.equal(body.name, 'Katherine Johnson');
    assert.equal(body.orderCount, 1);
    assert.equal(body.totalCents, 4200);
  } finally {
    server.close();
  }
});

test('GET /users/:id/summary returns 404 for an unknown user', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/users/does-not-exist/summary');
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
