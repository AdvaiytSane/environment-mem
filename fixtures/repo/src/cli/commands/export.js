import { listOrders } from '../../domain/orders.js';
import { toCsv } from '../../lib/csv.js';

const EXPORT_COLUMNS = ['id', 'userId', 'status', 'amountCents'];

export function run(args) {
  const orders = listOrders();
  console.log(toCsv(orders, EXPORT_COLUMNS));
}
