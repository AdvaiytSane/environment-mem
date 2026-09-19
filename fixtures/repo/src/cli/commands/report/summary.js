import { listOrders } from '../../../domain/orders.js';
import { listUsers } from '../../../domain/users.js';

export function run(args) {
  console.log('Users: ' + listUsers().length);
  console.log('Orders: ' + listOrders().length);
}
