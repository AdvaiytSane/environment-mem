import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('stats prints totals as text', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'stats'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Users: 5/);
  assert.match(result.stdout, /Orders: 10/);
});

test('an unknown flag is rejected', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'stats', '--bogus'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown flag/);
});
