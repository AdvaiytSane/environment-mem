import { listUsers } from '../../domain/users.js';
import { listOrders } from '../../domain/orders.js';

export function computeStats() {
  const users = listUsers();
  const orders = listOrders();
  return {
    totalUsers: users.length,
    totalOrders: orders.length,
    refundedOrders: orders.filter((order) => order.status === 'refunded').length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
  };
}

export function run(args) {
  const stats = computeStats();
  console.log('Users: ' + stats.totalUsers);
  console.log('Orders: ' + stats.totalOrders);
  console.log('Refunded: ' + stats.refundedOrders);
  console.log('Pending: ' + stats.pendingOrders);
}
