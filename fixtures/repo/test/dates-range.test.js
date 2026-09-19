import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysInMonth, monthRange } from '../src/lib/dates.js';

test('daysInMonth returns the number of days in the given month', () => {
  assert.equal(daysInMonth(2025, 3), 31);
});

test('monthRange returns one entry per day of the month', () => {
  const dates = monthRange(2025, 3);
  assert.equal(dates.length, 31);
  assert.equal(dates[0], '2025-03-01');
  assert.equal(dates[dates.length - 1], '2025-03-31');
});
