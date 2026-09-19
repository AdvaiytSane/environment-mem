import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listOrders, getOrder, ordersForUser } from '../src/domain/orders.js';

test('listOrders returns all seeded orders', () => {
  assert.equal(listOrders().length, 10);
});

test('getOrder finds an order by id', () => {
  const order = getOrder('o3');
  assert.equal(order.userId, 'u2');
  assert.equal(order.amountCents, 10000);
});

test('getOrder returns null for an unknown id', () => {
  assert.equal(getOrder('does-not-exist'), null);
});

test('ordersForUser filters by user', () => {
  assert.equal(ordersForUser('u3').length, 2);
});
