import { getOrder } from './orders.js';
import { isWithinRefundWindow } from './policies/refund-window.js';

export function issueRefund(orderId, now = new Date()) {
  const order = getOrder(orderId);
  if (!order) {
    throw new Error('Order not found: ' + orderId);
  }
  if (order.status === 'refunded') {
    throw new Error('Order already refunded');
  }
  if (!isWithinRefundWindow(order, now)) {
    throw new Error('Refund window has expired');
  }
  order.status = 'refunded';
  return order;
}
