import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('export header matches the declared column order', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'export'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines[0], 'id,userId,status,amountCents');
});

test('export data rows follow the same column order as the header', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'export'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines[3], 'o3,u2,paid,10000');
});
