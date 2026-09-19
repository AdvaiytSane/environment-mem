import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { average } from '../src/lib/math/average.js';
import { median } from '../src/lib/math/median.js';
import { clamp } from '../src/lib/math/clamp.js';

test('average computes the mean', () => {
  assert.equal(average([1, 2, 3]), 2);
});

test('median handles even and odd lengths', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('clamp bounds a value', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-5, 0, 10), 0);
});
