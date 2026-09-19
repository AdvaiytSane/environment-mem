import * as stats from './stats.js';
import * as list from './list.js';
import * as exportCommand from './export.js';
import * as users from './users.js';
import * as orders from './orders.js';
import * as health from './health.js';
import * as report from './report.js';

// A command module must be registered here to be reachable from main.js.
export const COMMANDS = {
  stats,
  list,
  export: exportCommand,
  users,
  orders,
  health,
  report,
};
