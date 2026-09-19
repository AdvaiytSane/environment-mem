import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateId, isValidId } from '../src/lib/ids.js';

test('generateId produces an id with the given prefix', () => {
  const id = generateId('order');
  assert.ok(id.startsWith('order_'));
});

test('isValidId checks the prefix', () => {
  const id = generateId('order');
  assert.equal(isValidId(id, 'order'), true);
  assert.equal(isValidId(id, 'user'), false);
});
