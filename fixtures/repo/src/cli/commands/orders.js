import { getOrder } from '../../domain/orders.js';

export function run(args) {
  const [id] = args._;
  if (!id) {
    console.error('Usage: orders <order-id>');
    process.exitCode = 1;
    return;
  }
  const order = getOrder(id);
  if (!order) {
    console.error('Order not found: ' + id);
    process.exitCode = 1;
    return;
  }
  console.log(order.id + '\t' + order.userId + '\t' + order.status + '\t' + order.amountCents);
}
