import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, addDays, daysBetween, isSameDay } from '../src/lib/dates.js';

test('formatDate renders an ISO date as YYYY-MM-DD', () => {
  assert.equal(formatDate('2025-03-10T00:00:00.000Z'), '2025-03-10');
});

test('addDays advances a date by the given number of days', () => {
  const result = addDays('2025-03-10T00:00:00.000Z', 5);
  assert.equal(formatDate(result), '2025-03-15');
});

test('daysBetween measures the gap between two dates', () => {
  assert.equal(daysBetween('2025-03-10T00:00:00.000Z', '2025-03-15T00:00:00.000Z'), 5);
});

test('isSameDay compares calendar days', () => {
  assert.equal(isSameDay('2025-03-10T01:00:00.000Z', '2025-03-10T23:00:00.000Z'), true);
  assert.equal(isSameDay('2025-03-10T23:00:00.000Z', '2025-03-11T01:00:00.000Z'), false);
});
