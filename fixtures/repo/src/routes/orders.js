import { listOrders, getOrder } from '../domain/orders.js';
import { sendJson, sendError } from '../lib/http-helpers.js';

export function handleOrders(req, res) {
  sendJson(res, 200, { orders: listOrders() });
}

export function handleOrderById(req, res, ctx) {
  const [id] = ctx.params;
  const order = getOrder(id);
  if (!order) {
    sendError(res, 404, 'order not found');
    return;
  }
  sendJson(res, 200, { order });
}
