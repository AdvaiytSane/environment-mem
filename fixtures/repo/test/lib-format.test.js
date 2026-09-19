import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTable } from '../src/lib/format/table.js';
import { prettyJson } from '../src/lib/format/json.js';
import { formatBytes } from '../src/lib/format/bytes.js';

test('renderTable pads columns to line up', () => {
  const table = renderTable([{ id: 'o1', status: 'paid' }], ['id', 'status']);
  assert.match(table, /^id\s+status$/m);
});

test('prettyJson indents with two spaces', () => {
  assert.equal(prettyJson({ a: 1 }), '{\n  "a": 1\n}');
});

test('formatBytes scales to the nearest unit', () => {
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(2048), '2.0 KB');
});
