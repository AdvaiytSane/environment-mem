import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRaceSpecs, raceId } from '../src/run.ts';

test('raceId is 8 lowercase base36 chars, and varies', () => {
  const a = raceId(), b = raceId();
  assert.match(a, /^[0-9a-z]{8}$/);
  assert.match(b, /^[0-9a-z]{8}$/);
  assert.notEqual(a, b);
});

test('buildRaceSpecs labels both lanes race:<id>, cold uninjected and warm full', () => {
  const { cold, warm } = buildRaceSpecs('abcd1234', { agent: 'claude', task: 'bugfix-1', model: 'sonnet' });
  assert.equal(cold.repoLabel, 'race:abcd1234');
  assert.equal(warm.repoLabel, 'race:abcd1234');
  assert.equal(cold.inject, '0');
  assert.equal(warm.inject, 'full');
  assert.equal(cold.record, true);
  assert.equal(warm.record, true);
  assert.equal(cold.agent, 'claude');
  assert.equal(warm.agent, 'claude');
  assert.equal(cold.task, 'bugfix-1');
  assert.equal(warm.task, 'bugfix-1');
  assert.equal(cold.model, 'sonnet');
  assert.equal(warm.model, 'sonnet');
  assert.notEqual(cold.lane, warm.lane);
});

test('two races produce distinct repo labels', () => {
  const one = buildRaceSpecs(raceId(), { agent: 'devin', task: 't' });
  const two = buildRaceSpecs(raceId(), { agent: 'devin', task: 't' });
  assert.notEqual(one.cold.repoLabel, two.cold.repoLabel);
});
