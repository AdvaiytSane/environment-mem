import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordersForUser, total } from '../src/domain/orders.js';

test('total excludes refunded orders', () => {
  const orders = ordersForUser('u1');
  assert.equal(total(orders), 6200);
});
