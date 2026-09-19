import { listOrders } from '../../../domain/orders.js';
import { groupBy } from '../../../lib/collections/group-by.js';

function monthKey(iso) {
  return iso.slice(0, 7);
}

export function run(args) {
  const groups = groupBy(listOrders(), (order) => monthKey(order.createdAt));
  for (const [month, orders] of Object.entries(groups)) {
    console.log(month + ': ' + orders.length);
  }
}
