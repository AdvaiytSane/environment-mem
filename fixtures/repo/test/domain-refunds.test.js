import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueRefund } from '../src/domain/refunds.js';
import { getOrder } from '../src/domain/orders.js';

test('issueRefund marks an order refunded within the window', () => {
  const order = issueRefund('o5', new Date('2025-02-15T00:00:00.000Z'));
  assert.equal(order.status, 'refunded');
  assert.equal(getOrder('o5').status, 'refunded');
});

test('issueRefund rejects an order that is already refunded', () => {
  assert.throws(() => issueRefund('o2', new Date('2025-01-25T00:00:00.000Z')), /already refunded/);
});

test('issueRefund rejects a refund outside the window', () => {
  assert.throws(() => issueRefund('o1', new Date('2026-06-01T00:00:00.000Z')), /window has expired/);
});
