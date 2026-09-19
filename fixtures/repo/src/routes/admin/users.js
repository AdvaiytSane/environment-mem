import { listUsers } from '../../domain/users.js';
import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminUsers(req, res) {
  const users = listUsers();
  sendJson(res, 200, { count: users.length, users });
}
