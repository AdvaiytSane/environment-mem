import { sendJson } from '../../lib/http-helpers.js';

export function handleAdminLogs(req, res) {
  sendJson(res, 200, { logs: [] });
}
