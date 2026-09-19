import { handleHealth } from './routes/health.js';
import { handleUsers, handleUserById } from './routes/users.js';
import { handleOrders, handleOrderById } from './routes/orders.js';
import { handleAdminStats } from './routes/admin/stats.js';
import { handleAdminAudit } from './routes/admin/audit.js';
import { handleAdminConfig } from './routes/admin/config.js';
import { handleAdminReports } from './routes/admin/reports.js';
import { handleAdminUsers } from './routes/admin/users.js';
import { handleAdminOrders } from './routes/admin/orders.js';
import { handleAdminExports } from './routes/admin/exports.js';
import { handleAdminLogs } from './routes/admin/logs.js';
import { sendError } from './lib/http-helpers.js';

// Every route handler must be added here to take effect. A route file that
// exists under src/routes/ but is not listed in ROUTES is never reached.
const ROUTES = [
  { method: 'GET', pattern: /^\/health$/, handler: handleHealth },
  { method: 'GET', pattern: /^\/users$/, handler: handleUsers },
  { method: 'GET', pattern: /^\/users\/([^/]+)$/, handler: handleUserById },
  { method: 'GET', pattern: /^\/orders$/, handler: handleOrders },
  { method: 'GET', pattern: /^\/orders\/([^/]+)$/, handler: handleOrderById },
  { method: 'GET', pattern: /^\/admin\/stats$/, handler: handleAdminStats },
  { method: 'GET', pattern: /^\/admin\/audit$/, handler: handleAdminAudit },
  { method: 'GET', pattern: /^\/admin\/config$/, handler: handleAdminConfig },
  { method: 'GET', pattern: /^\/admin\/reports$/, handler: handleAdminReports },
  { method: 'GET', pattern: /^\/admin\/users$/, handler: handleAdminUsers },
  { method: 'GET', pattern: /^\/admin\/orders$/, handler: handleAdminOrders },
  { method: 'GET', pattern: /^\/admin\/exports$/, handler: handleAdminExports },
  { method: 'GET', pattern: /^\/admin\/logs$/, handler: handleAdminLogs },
];

export function createRouter() {
  return {
    routes: ROUTES,
    handle(req, res) {
      const url = new URL(req.url, 'http://localhost');
      const match = ROUTES.find(
        (route) => route.method === req.method && route.pattern.test(url.pathname)
      );
      if (!match) {
        sendError(res, 404, 'not found');
        return;
      }
      const params = match.pattern.exec(url.pathname).slice(1);
      match.handler(req, res, { params, url });
    },
  };
}
