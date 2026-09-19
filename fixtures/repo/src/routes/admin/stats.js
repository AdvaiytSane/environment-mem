import { listUsers } from '../../domain/users.js';
import { listOrders } from '../../domain/orders.js';
import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminStats(req, res) {
  const users = listUsers();
  const orders = listOrders();
  sendJson(res, 200, {
    totalUsers: users.length,
    totalOrders: orders.length,
  });
}
