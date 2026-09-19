import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBy } from '../src/lib/collections/group-by.js';
import { partition } from '../src/lib/collections/partition.js';
import { dedupeBy } from '../src/lib/collections/dedupe.js';

test('groupBy buckets items by key', () => {
  const groups = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'));
  assert.deepEqual(groups.even, [2, 4]);
  assert.deepEqual(groups.odd, [1, 3]);
});

test('partition splits by predicate', () => {
  const [pass, fail] = partition([1, 2, 3, 4], (n) => n > 2);
  assert.deepEqual(pass, [3, 4]);
  assert.deepEqual(fail, [1, 2]);
});

test('dedupeBy keeps the first item per key', () => {
  const items = [{ id: 'a' }, { id: 'a' }, { id: 'b' }];
  assert.equal(dedupeBy(items, (item) => item.id).length, 2);
});
