import { sendJson } from '../../lib/http-helpers.js';

const AUDIT_LOG = [];

export function handleAdminAudit(req, res) {
  sendJson(res, 200, { entries: AUDIT_LOG });
}
