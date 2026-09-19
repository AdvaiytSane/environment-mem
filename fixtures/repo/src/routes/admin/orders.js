import { listOrders } from '../../domain/orders.js';
import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminOrders(req, res) {
  const orders = listOrders();
  sendJson(res, 200, { count: orders.length, orders });
}
