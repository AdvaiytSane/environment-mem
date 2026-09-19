import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

test('GET /users lists all seeded users', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/users');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.users.length, 5);
  } finally {
    server.close();
  }
});

test('GET /users/:id returns 404 for an unknown user', async () => {
  const server = await start(0);
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/users/does-not-exist');
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
