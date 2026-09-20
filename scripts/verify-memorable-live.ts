/** Opt-in service verification using real local tool executions. This is a
 * reference coding loop, not a Claude/Codex/Devin session or quality benchmark. */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createMemorable } from '../src/sdk/index.ts';

const resumeIndex = process.argv.indexOf('--resume');
const resume = resumeIndex < 0 ? undefined : process.argv[resumeIndex + 1];
if (resumeIndex >= 0 && (!resume || resume.startsWith('--'))) throw new Error('--resume requires a previous artifact directory');
if (!resume && !process.argv.includes('--allow-live-write')) {
  throw new Error('This check submits one disposable coding trace to your configured Memorable account. Re-run with --allow-live-write.');
}
const configFile = join(homedir(), '.memorable', 'config.json');
const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
const apiKey = process.env.MEMORABLE_API_KEY ?? config.api_key;
const apiUrl = process.env.MEMORABLE_API_URL ?? config.api_url;
if (!apiKey || !apiUrl) throw new Error('Configure Memorable credentials before running the live check');
if (!resume && !process.env.MEMORABLE_API_KEY && config.consent !== 'read-write') throw new Error('Existing Memorable write consent is not enabled');
if (new URL(apiUrl).protocol !== 'https:' || new URL(apiUrl).hostname !== 'memorable-extraction-api.memorable.workers.dev') {
  throw new Error('This verifier only submits to the documented Memorable extraction service');
}
const base = resume ? resolve(resume) : mkdtempSync(join(tmpdir(), 'environment-mem-live-'));
const cwd = join(base, 'project');
const memoryHome = join(base, 'memory-home');
const source = 'export const remainingRetries = (budget, attempts) => Math.max(0, budget - attempts + 1);\n';
if (!resume) {
  mkdirSync(cwd);
  mkdirSync(join(memoryHome, '.memorable'), { recursive: true });
  writeFileSync(join(memoryHome, '.memorable', 'config.json'), JSON.stringify({ consent: 'read-write', backend: 'local', api_url: apiUrl }), { mode: 0o600 });
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(join(cwd, 'retry-budget.js'), source);
  writeFileSync(join(cwd, 'retry-budget.test.js'), `
  import test from 'node:test';
  import assert from 'node:assert/strict';
  import {remainingRetries} from './retry-budget.js';
  test('remaining retry budget handles fresh, partial, exhausted and overdrawn budgets', () => {
    assert.equal(remainingRetries(3, 0), 3);
    assert.equal(remainingRetries(5, 2), 3);
    assert.equal(remainingRetries(3, 3), 0);
    assert.equal(remainingRetries(3, 4), 0);
  });
  `);
}
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const memorableCommand = process.env.HEADSTART_MEMORABLE_BIN ?? 'memorable';
const memorableArgs = process.env.HEADSTART_MEMORABLE_ARGS ? JSON.parse(process.env.HEADSTART_MEMORABLE_ARGS) : [];
const env = { ...process.env, MEMORABLE_HOME: memoryHome, MEMORABLE_API_KEY: apiKey, MEMORABLE_API_URL: apiUrl,
  MEMORABLE_BACKEND: 'local', HEADSTART_BACKEND: 'memorable', HEADSTART_HARNESS: 'claude-code',
  HEADSTART_STATE_DIR: join(cwd, '.headstart'), HEADSTART_STORE: join(cwd, '.headstart', 'procedures.jsonl'),
  HEADSTART_RECORD: '1', HEADSTART_INJECT: 'full', NO_COLOR: '1' };
const report: Record<string, unknown> = { at: new Date().toISOString(), runner: 'reference coding loop',
  node: process.version, transport: 'published CLI + live extraction API', backend: 'isolated local Memorable store',
  nativeHarness: 'not exercised by this script', remoteDurability: 'not verified', fullTracePreservation: 'not provided',
  artifacts: base, status: 'running' };
if (resume) {
  const previous = JSON.parse(readFileSync(join(base, 'report.json'), 'utf8'));
  report.originalRunAt = previous.originalRunAt ?? previous.at;
  report.capture = previous.capture;
  report.priorStatus = previous.status;
  report.priorError = previous.error;
  report.resumedReadback = true;
}
const sessionId = `verify-${randomUUID()}`;
const runId = randomUUID();
const ledger: Array<{ id: string; name: string; exitCode?: number }> = [];
const hook = (event: string, raw: Record<string, unknown>) => {
  const p = spawnSync(process.execPath, [cli, 'hook', event], { cwd, env, encoding: 'utf8', timeout: 45_000,
    input: JSON.stringify({ cwd, session_id: sessionId, run_id: runId, ...raw }) });
  assert.equal(p.status, 0, p.stderr);
  return p;
};
const record = (name: string, input: Record<string, unknown>, result: Record<string, unknown>, exitCode?: number) => {
  const id = `call-${ledger.length + 1}`;
  ledger.push({ id, name, ...(exitCode === undefined ? {} : { exitCode }) });
  hook('PostToolUse', { tool_use_id: id, tool_name: name, tool_input: input, tool_response: result });
};
const invoke = (args: string[]) => spawnSync(memorableCommand, [...memorableArgs, ...args], { cwd, env, encoding: 'utf8', timeout: 40_000 });
try {
  report.cliVersion = invoke(['version']).stdout.trim();
  if (!resume) {
    hook('UserPromptSubmit', { prompt: 'Fix an off-by-one error in the remaining retry budget calculation and verify fresh, partial and exhausted attempts' });
    const read = readFileSync(join(cwd, 'retry-budget.js'), 'utf8');
    record('Read', { file_path: 'retry-budget.js' }, { ok: true, content: read });
    const failing = spawnSync(process.execPath, ['--test', 'retry-budget.test.js'], { cwd, encoding: 'utf8' });
    assert.notEqual(failing.status, 0);
    record('Bash', { command: 'node --test retry-budget.test.js' }, { exit_code: failing.status, stdout: failing.stdout }, failing.status!);
    writeFileSync(join(cwd, 'retry-budget.js'), source.replace('attempts + 1', 'attempts'));
    record('Edit', { file_path: 'retry-budget.js', old_string: 'attempts + 1', new_string: 'attempts' }, { ok: true });
    const passing = spawnSync(process.execPath, ['--test', 'retry-budget.test.js'], { cwd, encoding: 'utf8' });
    assert.equal(passing.status, 0, passing.stdout);
    record('Bash', { command: 'node --test retry-budget.test.js' }, { exit_code: passing.status, stdout: passing.stdout }, passing.status!);
    const stopped = hook('Stop', {});
    report.stopStderr = stopped.stderr;
    const journalDir = join(cwd, '.headstart', 'sessions');
    const journal = readdirSync(journalDir).flatMap(file => readFileSync(join(journalDir, file), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
    const calls = journal.filter(e => e.event === 'tool');
    assert.deepEqual(calls.map(e => e.tool_call_id), ledger.map(e => e.id));
    assert.deepEqual(calls.filter(e => e.result?.exit_code !== undefined).map(e => e.result.exit_code), [failing.status, passing.status]);
    report.capture = { status: 'verified for reference loop', calls: calls.length, commandExits: [failing.status, passing.status] };
  }
  const status = spawnSync(process.execPath, [cli, 'connection'], { cwd, env, encoding: 'utf8' });
  report.connection = JSON.parse(status.stdout);
  const listed = invoke(['list', '--json']);
  report.listExit = listed.status;
  let entries: Array<{ preferred: string }>;
  try { entries = JSON.parse(listed.stdout); }
  catch { throw new Error(`No structured stored-procedure readback: ${listed.stdout.slice(0, 1000)} ${listed.stderr.slice(0, 1000)}`); }
  assert.equal(entries.length, 1, 'one procedure must be independently visible in the fresh isolated store');
  const slug = entries[0].preferred;
  report.procedureId = slug;
  // Each SDK operation starts a fresh CLI process; the store is not shared JS memory.
  const memory = createMemorable({ command: memorableCommand, args: memorableArgs, cwd, env });
  const queries = [
    'Correct how many retries are left after several attempts have already been used',
    'Fix an off-by-one error in the remaining retry budget calculation',
    'retry-budget.js',
    'Arrange flowers for a wedding reception',
  ];
  const retrieval = [];
  for (const query of queries) {
    const recalled = await memory.recall({ query, mode: 'single' });
    retrieval.push({ query, retrieved: recalled.stdout.includes(slug), text: recalled.stdout.trim() });
  }
  report.retrieval = retrieval;
  const shown = await memory.recall({ procedureId: slug });
  report.procedureText = shown.stdout;
  assert.match(shown.stdout, /retry-budget/);
  assert.ok(retrieval[1].retrieved, 'close query must retrieve the stored procedure');
  assert.ok(retrieval[2].retrieved, 'exact filename must retrieve the stored procedure');
  assert.ok(!retrieval[3].retrieved, 'unrelated query must not surface the stored coding procedure');
  const prompt = hook('UserPromptSubmit', { run_id: randomUUID(), prompt: queries[1] });
  const injection = JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext;
  assert.ok(injection.includes(slug));
  report.contextDelivery = 'verified at reference-hook JSON boundary; not native model consumption';
  const storeFile = join(memoryHome, '.memorable', 'procedures.jsonl');
  report.localStore = { exists: existsSync(storeFile), sha256: createHash('sha256').update(readFileSync(storeFile)).digest('hex') };
  report.status = retrieval[0].retrieved ? 'verified_cli_round_trip' : 'partial_paraphrase_missed';
  if (!retrieval[0].retrieved) process.exitCode = 1;
} catch (error) {
  report.status = 'failed_or_blocked';
  report.error = String(error).replaceAll(apiKey, '[redacted]');
  process.exitCode = 1;
} finally {
  const reportFile = join(base, resume ? 'readback-report.json' : 'report.json');
  writeFileSync(reportFile, JSON.stringify(report, null, 2).replaceAll(apiKey, '[redacted]'), { mode: 0o600 });
  console.log(JSON.stringify({ status: report.status, report: reportFile, capture: report.capture, error: report.error }));
}
