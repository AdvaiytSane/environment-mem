import { sendJson } from '../lib/http-helpers.js';

export function handleHealth(req, res) {
  sendJson(res, 200, { ok: true });
}
