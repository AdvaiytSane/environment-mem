import { listUsers } from '../../domain/users.js';

export function run(args) {
  for (const user of listUsers()) {
    console.log(user.id + '\t' + user.name + '\t' + user.email);
  }
}
