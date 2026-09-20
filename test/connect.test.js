import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectConnection, writeConnection } from '../src/connect.ts';
import { extractPayload } from '../src/api.ts';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'memorable-connect-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), value);
  };
  write('app.py', 'from browser_use import Agent, Tools\nagent = Agent(task=task)\nresult = await agent.run()\nverification = check_page()\n');
  write('.env', 'OPENAI_API_KEY=connect-test-secret-do-not-read\n');
  return { root, write };
}

test('connect is read-only, distinguishes application from coding host, and reports candidates without source contents', t => {
  const { root } = repo(t);
  const before = readdirSync(root).sort();
  const run = spawnSync(process.execPath, [cli, 'connect', '--repo', root, '--target', 'application', '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.schema, 'memorable.connect.v1');
  assert.equal(report.target, 'application');
  assert.equal(report.frameworks[0].id, 'browser-use');
  assert.equal(report.seams.find(s => s.kind === 'boundary').line, 3);
  assert.equal(report.seams.find(s => s.kind === 'capture').status, 'needs_adapter');
  assert.ok(Object.values(report.status).every(v => v === null));
  assert.ok(!run.stdout.includes('connect-test-secret'));
  assert.ok(!run.stdout.includes('await agent.run()'));
  assert.deepEqual(readdirSync(root).sort(), before);
  const coding = inspectConnection(root, { target: 'coding-agent', agent: 'devin' });
  assert.equal(coding.seams.find(s => s.kind === 'injection').file, '.claude/settings.json');
  assert.equal(coding.status.contextDelivered, null);
});

test('writing setup preserves developer metadata, other hooks and config; only explicit installation sets installed', t => {
  const { root, write } = repo(t);
  const hook = { type: 'command', command: 'existing-hook --keep' };
  write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { Stop: [{ hooks: [hook] }] } }));
  write('.headstart/config.json', JSON.stringify({ backend: 'memorable', owner: 'keep-me' }));
  const options = { target: 'coding-agent', agent: 'claude' };
  let report = inspectConnection(root, options);
  const hookBefore = readFileSync(join(root, '.claude/settings.json'), 'utf8');
  writeConnection(report, options);
  assert.equal(readFileSync(join(root, '.claude/settings.json'), 'utf8'), hookBefore);
  assert.equal(report.status.installed, null);
  const manifestPath = join(root, '.memorable/connection.json');
  const initial = JSON.parse(readFileSync(manifestPath, 'utf8'));
  initial.metadata.website = { use: 'filter' };
  initial.developerNote = 'keep this customization';
  writeFileSync(manifestPath, JSON.stringify(initial));
  report = inspectConnection(root, options);
  writeConnection(report, { ...options, installHooks: true });
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.developerNote, initial.developerNote);
  assert.deepEqual(manifest.metadata.website, { use: 'filter' });
  assert.equal(manifest.createdAt, initial.createdAt);
  assert.equal(manifest.status.installed, true);
  assert.equal(manifest.status.stored, null);
  assert.equal(manifest.status.contextDelivered, null);
  assert.equal(JSON.parse(readFileSync(join(root, '.headstart/config.json'), 'utf8')).owner, 'keep-me');
  const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.hooks.Stop[0].hooks, [hook]);
  assert.deepEqual(settings.permissions, { allow: ['Read'] });
});

test('connect refuses target changes, unowned skills and symlink output paths before writing hooks', t => {
  const { root, write } = repo(t);
  const app = inspectConnection(root, { target: 'application' });
  writeConnection(app);
  assert.throws(() => writeConnection(inspectConnection(root, { target: 'coding-agent', agent: 'claude' }), { installHooks: true }), /another schema, target or agent/);
  assert.equal(existsSync(join(root, '.claude/settings.json')), false);
  write('.agents/skills/memorable-connect/SKILL.md', 'This is my existing skill.');
  assert.throws(() => writeConnection(app), /not owned/);
  rmSync(join(root, '.memorable'), { recursive: true });
  const outside = mkdtempSync(join(tmpdir(), 'memorable-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(root, '.memorable'));
  assert.throws(() => writeConnection(app), /symlinked/);
  assert.deepEqual(readdirSync(outside), []);
});

test('read-only inspection and repeated CLI setup preserve the declared local route and metadata', t => {
  const { root, write } = repo(t);
  const config = JSON.stringify({ backend: 'local', owner: 'preserve existing config' });
  write('.headstart/config.json', config);
  const run = (...args) => spawnSync(process.execPath, [cli, 'connect', '--repo', root, ...args, '--json'], { encoding: 'utf8' });
  const initial = run('--target', 'coding-agent', '--agent', 'devin', '--write');
  assert.equal(initial.status, 0, initial.stderr);
  assert.equal(JSON.parse(initial.stdout).backend, 'local');
  const path = join(root, '.memorable/connection.json');
  const customized = JSON.parse(readFileSync(path, 'utf8'));
  customized.metadata = { repository: { use: 'filter' }, objective: { use: 'semantic' }, evidence: { use: 'context' } };
  writeFileSync(path, JSON.stringify(customized));
  const before = readFileSync(path, 'utf8');
  const inspection = run();
  assert.equal(inspection.status, 0, inspection.stderr);
  const report = JSON.parse(inspection.stdout);
  assert.equal(report.target, 'coding-agent');
  assert.equal(report.agent, 'devin');
  assert.equal(report.backend, 'local');
  assert.deepEqual(report.metadata, customized.metadata);
  assert.equal(readFileSync(path, 'utf8'), before);
  const repeated = run('--target', 'coding-agent', '--write');
  assert.equal(repeated.status, 0, repeated.stderr);
  const stored = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(stored.backend, 'local');
  assert.equal(stored.agent, 'devin');
  assert.deepEqual(stored.metadata, customized.metadata);
  assert.equal(readFileSync(join(root, '.headstart/config.json'), 'utf8'), config);
  assert.ok(Object.values(JSON.parse(repeated.stdout).status).every(value => value === null));
  const stable = readFileSync(path, 'utf8');
  const conflict = run('--backend', 'memorable', '--write');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /backend conflicts/);
  assert.equal(readFileSync(path, 'utf8'), stable);
  assert.equal(readFileSync(join(root, '.headstart/config.json'), 'utf8'), config);
  assert.throws(() => writeConnection({ ...report, backend: 'memorable' }), /backend conflicts/);
  write('.headstart/config.json', JSON.stringify({ backend: 'memorable' }));
  assert.throws(() => inspectConnection(root), /backend declarations conflict/);
  assert.throws(() => writeConnection(report), /backend declarations conflict/);
});

test('merged CLI retains SDK and demo commands, and hosted capture does not invent missing exit codes', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  for (const name of ['connect', 'orchestrate', 'demo', 'memory', 'sync']) assert.ok(help.stdout.includes(name));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.bin.dejado, pkg.bin.headstart);
  assert.ok(pkg.exports['./memorable']);
  assert.ok(existsSync(new URL('../dist/ui/index.html', import.meta.url)));
  const payload = extractPayload([
    { ts: 1, event: 'prompt', session_id: 's', cwd: '/fixture', prompt: 'a real task' },
    { ts: 2, event: 'tool', session_id: 's', cwd: '/fixture', tool_name: 'Bash', tool_input: { command: 'npm test' } },
  ]);
  assert.equal(payload.tool_calls[0].result, undefined);
});
