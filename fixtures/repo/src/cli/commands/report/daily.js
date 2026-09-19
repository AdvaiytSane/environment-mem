import { listOrders } from '../../../domain/orders.js';
import { groupBy } from '../../../lib/collections/group-by.js';
import { formatDate } from '../../../lib/dates.js';

export function run(args) {
  const groups = groupBy(listOrders(), (order) => formatDate(order.createdAt));
  for (const [day, orders] of Object.entries(groups)) {
    console.log(day + ': ' + orders.length);
  }
}
