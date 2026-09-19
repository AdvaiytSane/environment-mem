import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordersForUser, total } from '../src/domain/orders.js';

test('total excludes refunded orders for a different user', () => {
  const orders = ordersForUser('u2');
  assert.equal(total(orders), 13000);
});
