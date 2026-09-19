import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/registry.js';

test('every registered route has a method, a pattern and a handler', () => {
  const router = createRouter();
  assert.ok(router.routes.length > 0);
  for (const route of router.routes) {
    assert.equal(typeof route.method, 'string');
    assert.ok(route.pattern instanceof RegExp);
    assert.equal(typeof route.handler, 'function');
  }
});
