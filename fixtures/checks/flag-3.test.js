import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_PATH = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));

function parseCsv(output) {
  const lines = output.trim().split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((name, i) => {
      row[name] = cells[i];
    });
    return row;
  });
  return { header, rows };
}

test('users --format csv prints one CSV row per user', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'users', '--format', 'csv'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const { header, rows } = parseCsv(result.stdout);
  assert.deepEqual([...header].sort(), ['email', 'id', 'name']);
  assert.equal(rows.length, 5);
  const ada = rows.find((row) => row.id === 'u1');
  assert.equal(ada.name, 'Ada Lovelace');
  assert.equal(ada.email, 'ada@example.com');
});

test('users with no format still prints the plain rows', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'users'], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 5);
  assert.ok(!lines[0].includes(','));
});
