import { listOrders } from '../../domain/orders.js';
import { toCsv } from '../../lib/csv.js';
import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminExports(req, res) {
  const orders = listOrders();
  const csv = toCsv(orders, ['id', 'userId', 'status', 'amountCents']);
  sendJson(res, 200, { csv });
}
