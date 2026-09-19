import { sendJson } from '../../lib/http-helpers.js';

const CONFIG = { refundWindowDays: 30, currency: 'USD' };

export function handleAdminConfig(req, res) {
  sendJson(res, 200, { config: CONFIG });
}
