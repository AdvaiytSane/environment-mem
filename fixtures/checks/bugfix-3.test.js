import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysInMonth, monthRange } from '../src/lib/dates.js';

test('daysInMonth handles a leap year February correctly', () => {
  assert.equal(daysInMonth(2024, 2), 29);
});

test('monthRange stays within the requested month', () => {
  const dates = monthRange(2025, 4);
  assert.equal(dates.length, 30);
  assert.equal(dates[0], '2025-04-01');
  assert.equal(dates[dates.length - 1], '2025-04-30');
});
