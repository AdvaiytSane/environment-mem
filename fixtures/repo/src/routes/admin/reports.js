import { listOrders } from '../../domain/orders.js';
import { groupBy } from '../../lib/collections/group-by.js';
import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminReports(req, res) {
  const orders = listOrders();
  const byStatus = groupBy(orders, (order) => order.status);
  const summary = Object.fromEntries(
    Object.entries(byStatus).map(([status, group]) => [status, group.length])
  );
  sendJson(res, 200, { summary });
}
