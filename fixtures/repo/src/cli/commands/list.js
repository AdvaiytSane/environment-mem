import { listOrders } from '../../domain/orders.js';

export function run(args) {
  const orders = listOrders();
  for (const order of orders) {
    console.log(order.id + '\t' + order.userId + '\t' + order.status + '\t' + order.amountCents);
  }
}
