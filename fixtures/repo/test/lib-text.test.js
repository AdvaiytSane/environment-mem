import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../src/lib/text/wrap.js';
import { toTitleCase, toKebabCase } from '../src/lib/text/case.js';
import { ellipsis } from '../src/lib/text/ellipsis.js';

test('wrapText breaks on width', () => {
  const lines = wrapText('one two three four', 8);
  assert.deepEqual(lines, ['one two', 'three', 'four']);
});

test('toTitleCase capitalizes each word', () => {
  assert.equal(toTitleCase('grace hopper'), 'Grace Hopper');
});

test('toKebabCase converts camelCase to kebab-case', () => {
  assert.equal(toKebabCase('orderTotal'), 'order-total');
});

test('ellipsis truncates long strings', () => {
  assert.equal(ellipsis('abcdef', 4), 'abcd...');
});
