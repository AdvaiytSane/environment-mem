import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, toDollars, formatCents, addCents } from '../src/lib/money.js';

test('toCents converts dollars to integer cents', () => {
  assert.equal(toCents(12.5), 1250);
});

test('toDollars converts cents back to dollars', () => {
  assert.equal(toDollars(1250), 12.5);
});

test('formatCents renders a dollar amount', () => {
  assert.equal(formatCents(1250), '$12.50');
});

test('addCents sums a list of amounts', () => {
  assert.equal(addCents(100, 200, 300), 600);
});
