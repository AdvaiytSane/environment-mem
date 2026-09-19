import { listOrders } from '../../../domain/orders.js';

export function run(args) {
  console.log(JSON.stringify(listOrders()));
}
