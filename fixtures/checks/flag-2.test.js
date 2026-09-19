import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

test('list --limit caps the number of rows printed', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'list', '--limit', '3'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split('\n').filter((line) => line.length > 0);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].split('\t')[0], 'o1');
  assert.equal(lines[1].split('\t')[0], 'o2');
  assert.equal(lines[2].split('\t')[0], 'o3');
});

test('list with no limit still prints every row', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'list'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n').filter((line) => line.length > 0);
  assert.equal(lines.length, 10);
});
