import { listUsers, getUser } from '../domain/users.js';
import { sendJson, sendError } from '../lib/http-helpers.js';

export function handleUsers(req, res) {
  sendJson(res, 200, { users: listUsers() });
}

export function handleUserById(req, res, ctx) {
  const [id] = ctx.params;
  const user = getUser(id);
  if (!user) {
    sendError(res, 404, 'user not found');
    return;
  }
  sendJson(res, 200, { user });
}
