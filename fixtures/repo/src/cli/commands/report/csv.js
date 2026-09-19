import { listOrders } from '../../../domain/orders.js';
import { toCsv } from '../../../lib/csv.js';

export function run(args) {
  console.log(toCsv(listOrders(), ['id', 'status', 'amountCents']));
}
