import { listOrders } from '../../../domain/orders.js';

export function run(args) {
  const counts = {};
  for (const order of listOrders()) {
    const year = order.createdAt.slice(0, 4);
    counts[year] = (counts[year] ?? 0) + 1;
  }
  for (const [year, count] of Object.entries(counts)) {
    console.log(year + ': ' + count);
  }
}
