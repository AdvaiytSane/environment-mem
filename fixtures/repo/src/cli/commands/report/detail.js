import { getOrder } from '../../../domain/orders.js';

export function run(args) {
  const [id] = args._;
  const order = getOrder(id);
  if (!order) {
    console.error('Order not found: ' + id);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(order));
}
