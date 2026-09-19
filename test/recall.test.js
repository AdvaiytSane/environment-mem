import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recall, repoFacts } from '../src/recall.ts';

function seed() {
  const dir = mkdtempSync(join(tmpdir(), 'hs-'));
  const store = join(dir, 'procedures.jsonl');
  const mk = (id, task_id, prompt, extra = {}) => ({
    id, session_id: id, task_id, repo: 'fixture', created_at: '2026-09-19T00:00:00Z', title: prompt, prompt,
    steps: [], preconditions: ['src/cli/args.js'], postconditions: ['bash ops/check.sh'],
    files_written: ['src/cli/flags.js'], files_read: [], commands: [], discovery_calls: 3, total_calls: 6,
    search_text: prompt.toLowerCase().split(/\s+/).join(' ') + ' src/cli/flags.js', ...extra,
  });
  writeFileSync(store, [
    mk('a', 'flag-1', 'add a --json flag to the stats command'),
    mk('b', 'endpoint-1', 'add GET /health/deps endpoint', { files_written: ['src/routes/health.js', 'src/registry.js'], search_text: 'add get /health/deps endpoint src/routes/health.js src/registry.js' }),
    mk('c', 'bugfix-1', 'fix the orders total to exclude refunds', { files_written: ['src/domain/orders.js', 'src/registry.js'], search_text: 'fix the orders total to exclude refunds src/domain/orders.js' }),
  ].map(x => JSON.stringify(x)).join('\n') + '\n');
  process.env.HEADSTART_STORE = store;
  process.env.HEADSTART_REPO = 'fixture';
  return dir;
}

test('recall ranks the same-shape procedure first', () => {
  const dir = seed();
  const hits = recall(dir, 'add a --limit flag to the list command', { k: 3, minScore: 0 });
  assert.equal(hits[0].procedure.id, 'a');
});

test('recall excludes the task under evaluation', () => {
  const dir = seed();
  const hits = recall(dir, 'add a --json flag to the stats command', { k: 3, minScore: 0, excludeTask: 'flag-1' });
  assert.ok(hits.every(h => h.procedure.task_id !== 'flag-1'));
});

test('repo facts aggregate verify command and hubs', () => {
  const dir = seed();
  const f = repoFacts(dir);
  assert.deepEqual(f.verify, ['bash ops/check.sh']);
  assert.equal(f.sessions, 3);
  assert.deepEqual(f.hubs, ['src/registry.js']);
});
