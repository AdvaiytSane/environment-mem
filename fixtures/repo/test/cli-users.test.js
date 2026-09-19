import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('users prints one row per seeded user', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'users'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 5);
  assert.equal(lines[0], 'u1\tAda Lovelace\tada@example.com');
});
