import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, escapeCsvField } from '../src/lib/csv.js';

test('toCsv renders a header and one row per record', () => {
  const rows = [{ amountCents: 500, id: 'o1', status: 'paid' }];
  const csv = toCsv(rows, ['amountCents', 'id', 'status']);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'amountCents,id,status');
  assert.equal(lines[1], '500,o1,paid');
});

test('escapeCsvField quotes values containing a comma', () => {
  assert.equal(escapeCsvField('a,b'), '"a,b"');
  assert.equal(escapeCsvField('plain'), 'plain');
});
