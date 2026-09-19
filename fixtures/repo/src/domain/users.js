import { USERS } from './store.js';

export function listUsers() {
  return USERS;
}

export function getUser(id) {
  return USERS.find((user) => user.id === id) ?? null;
}
