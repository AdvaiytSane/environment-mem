import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNonEmptyString, isEmail, isPositiveInt, assert as assertFn } from '../src/lib/validation.js';

test('isNonEmptyString rejects blank strings', () => {
  assert.equal(isNonEmptyString('  '), false);
  assert.equal(isNonEmptyString('hi'), true);
});

test('isEmail checks basic email shape', () => {
  assert.equal(isEmail('ada@example.com'), true);
  assert.equal(isEmail('not-an-email'), false);
});

test('isPositiveInt requires a positive integer', () => {
  assert.equal(isPositiveInt(3), true);
  assert.equal(isPositiveInt(-1), false);
  assert.equal(isPositiveInt(1.5), false);
});

test('assert throws with the given message', () => {
  assert.throws(() => assertFn(false, 'boom'), /boom/);
});
