import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, pageCount } from '../src/lib/pagination.js';

test('paginate returns the requested page', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(paginate(items, 2, 3), [4, 5, 6]);
});

test('pageCount rounds up to a whole number of pages', () => {
  assert.equal(pageCount(7, 3), 3);
  assert.equal(pageCount(0, 3), 1);
});
