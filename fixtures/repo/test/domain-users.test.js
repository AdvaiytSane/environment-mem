import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listUsers, getUser } from '../src/domain/users.js';

test('listUsers returns all seeded users', () => {
  assert.equal(listUsers().length, 5);
});

test('getUser finds a user by id', () => {
  const user = getUser('u1');
  assert.equal(user.name, 'Ada Lovelace');
});

test('getUser returns null for an unknown id', () => {
  assert.equal(getUser('does-not-exist'), null);
});
