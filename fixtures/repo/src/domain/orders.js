import { ORDERS } from './store.js';

export function listOrders() {
  return ORDERS;
}

export function getOrder(id) {
  return ORDERS.find((order) => order.id === id) ?? null;
}

export function ordersForUser(userId) {
  return ORDERS.filter((order) => order.userId === userId);
}

export function total(orders) {
  return orders.reduce((sum, order) => sum + order.amountCents, 0);
}

export function removeOrder(id) {
  const index = ORDERS.findIndex((order) => order.id === id);
  if (index === -1) return false;
  ORDERS.splice(index, 1);
  return true;
}
