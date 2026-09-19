import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('export prints the header in id, userId, status, amountCents order', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'export'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines[0], 'id,userId,status,amountCents');
  assert.equal(lines[1], 'o1,u1,paid,5000');
});
