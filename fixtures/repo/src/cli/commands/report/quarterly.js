import { listOrders } from '../../../domain/orders.js';

function quarterOf(iso) {
  const month = Number(iso.slice(5, 7));
  return 'Q' + Math.ceil(month / 3);
}

export function run(args) {
  const counts = {};
  for (const order of listOrders()) {
    const quarter = quarterOf(order.createdAt);
    counts[quarter] = (counts[quarter] ?? 0) + 1;
  }
  for (const [quarter, count] of Object.entries(counts)) {
    console.log(quarter + ': ' + count);
  }
}
