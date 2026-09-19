import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('list prints one row per order', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'list'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 10);
});
