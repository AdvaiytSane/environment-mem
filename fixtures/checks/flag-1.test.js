import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('stats --json prints the stats object as JSON', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'stats', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.totalUsers, 5);
  assert.equal(parsed.totalOrders, 10);
  assert.equal(parsed.refundedOrders, 3);
  assert.equal(parsed.pendingOrders, 1);
});
