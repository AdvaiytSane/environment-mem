import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { claudeFormatHooks } from './install.ts';
import { classify } from './trace.ts';
import { renderDoc } from './inject.ts';
import type { TraceEvent } from './types.ts';

export type Arm = 'cold' | 'doc' | 'autodoc' | 'facts' | 'full';
export const ARMS: Arm[] = ['cold', 'doc', 'autodoc', 'facts', 'full'];

export interface Task { id: string; shape: string; prompt: string; hidden_test: string; visible_failing_test: string | null }

export interface Run {
  task: string; shape: string; arm: Arm; repeat: number; runner: string; model: string;
  input_tokens: number; cache_read: number; cache_create: number; output_tokens: number; context_tokens: number;
  turns: number; tool_calls: number; discovery_calls: number; duration_s: number; cost_usd: number;
  pass: boolean; injected_chars: number; error?: string; session_id?: string; workdir: string;
}

export interface EvalOpts {
  tasks: string; fixture: string; out: string; arms: Arm[]; repeats: number; runner: 'claude' | 'devin';
  model: string; parallel: number; staticDoc?: string; timeoutMs: number; only?: string[];
}

const CLI = resolve(new URL('./cli.ts', import.meta.url).pathname);

function sh(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv, timeoutMs = 120_000) {
  return spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
}

function prepareWorkdir(o: EvalOpts, t: Task, arm: Arm, r: number): string {
  const wd = join(o.out, 'work', `${t.id}-${arm}-${r}`);
  if (existsSync(wd)) return wd;
  cpSync(o.fixture, wd, { recursive: true, filter: p => !p.includes('/.git') && !p.includes('/.headstart') });
  const bin = `node ${CLI}`;
  mkdirSync(join(wd, '.claude'), { recursive: true });
  writeFileSync(join(wd, '.claude', 'settings.json'), JSON.stringify({ hooks: claudeFormatHooks(bin) }, null, 2));
  if (arm === 'doc' && o.staticDoc) {
    const doc = readFileSync(o.staticDoc, 'utf8');
    writeFileSync(join(wd, 'AGENTS.md'), doc);
    writeFileSync(join(wd, 'CLAUDE.md'), doc);
  }
  if (arm === 'autodoc') {
    // Same channel as the hand-written doc, content from the cold runs of the
    // other tasks. The store and repo name come from the eval env.
    const prev = { store: process.env.HEADSTART_STORE, repo: process.env.HEADSTART_REPO };
    process.env.HEADSTART_STORE = join(o.out, 'store.jsonl');
    process.env.HEADSTART_REPO = 'fixture';
    const doc = renderDoc(wd, t.id);
    process.env.HEADSTART_STORE = prev.store; process.env.HEADSTART_REPO = prev.repo;
    if (doc) { writeFileSync(join(wd, 'AGENTS.md'), doc); writeFileSync(join(wd, 'CLAUDE.md'), doc); }
  }
  sh('git', ['init', '-q'], wd);
  sh('git', ['add', '-A'], wd);
  sh('git', ['-c', 'user.email=eval@headstart', '-c', 'user.name=eval', 'commit', '-q', '-m', 'fixture'], wd);
  return wd;
}

function hookEnv(o: EvalOpts, t: Task, arm: Arm): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    HEADSTART_STORE: join(o.out, 'store.jsonl'),
    HEADSTART_REPO: 'fixture',
    HEADSTART_TASK_ID: t.id,
    HEADSTART_EXCLUDE_TASK: t.id,
    HEADSTART_INJECT: arm === 'full' ? 'full' : arm === 'facts' ? 'facts' : '0',
    HEADSTART_ARM: arm,
    HEADSTART_RECORD: arm === 'cold' ? '1' : '0',
  };
  return env;
}

interface RunnerResult { input: number; cacheRead: number; cacheCreate: number; output: number; turns: number; cost: number; sessionId?: string; error?: string; raw: string }

function runClaude(prompt: string, wd: string, env: NodeJS.ProcessEnv, model: string, timeoutMs: number): Promise<RunnerResult> {
  return new Promise(res => {
    const childEnv = { ...process.env, ...env };
    delete childEnv.CLAUDECODE; delete childEnv.CLAUDE_CODE_ENTRYPOINT;
    const args = ['-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions', '--model', model];
    const child = spawn('claude', args, { cwd: wd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out.trim().split('\n').filter(l => l.startsWith('{')).pop() ?? '{}');
        const u = j.usage ?? {};
        res({ input: u.input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheCreate: u.cache_creation_input_tokens ?? 0,
          output: u.output_tokens ?? 0, turns: j.num_turns ?? 0, cost: j.total_cost_usd ?? 0, sessionId: j.session_id,
          error: j.is_error ? String(j.result ?? 'is_error').slice(0, 200) : code ? `exit ${code}: ${err.slice(0, 200)}` : undefined, raw: out });
      } catch {
        res({ input: 0, cacheRead: 0, cacheCreate: 0, output: 0, turns: 0, cost: 0, error: `no json (exit ${code}): ${(err || out).slice(0, 200)}`, raw: out });
      }
    });
  });
}

function runDevin(prompt: string, wd: string, env: NodeJS.ProcessEnv, model: string, timeoutMs: number): Promise<RunnerResult> {
  return new Promise(res => {
    const exportPath = join(wd, '.headstart', 'devin-export.json');
    mkdirSync(join(wd, '.headstart'), { recursive: true });
    const args = ['-p', prompt, '--permission-mode', 'dangerous', '--respect-workspace-trust', 'false', '--export', exportPath];
    if (model) args.push('--model', model);
    const child = spawn('devin', args, { cwd: wd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      let input = 0, output = 0, cacheRead = 0, turns = 0;
      try {
        // ATIF v1.7: final_metrics.total_prompt_tokens already includes cached tokens.
        const j = JSON.parse(readFileSync(exportPath, 'utf8'));
        const m = j.final_metrics ?? {};
        cacheRead = m.total_cached_tokens ?? 0;
        input = (m.total_prompt_tokens ?? 0) - cacheRead;
        output = m.total_completion_tokens ?? 0;
        turns = m.total_steps ?? 0;
      } catch {}
      res({ input, cacheRead, cacheCreate: 0, output, turns, cost: 0, error: code ? `exit ${code}: ${err.slice(0, 200)}` : undefined, raw: out });
    });
  });
}

function traceStats(wd: string): { tool_calls: number; discovery_calls: number; injected_chars: number; session_id?: string } {
  const dir = join(wd, '.headstart', 'sessions');
  let events: TraceEvent[] = [];
  let session_id: string | undefined;
  if (existsSync(dir)) for (const f of readdirSync(dir)) {
    const evs = readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as TraceEvent);
    if (evs.length > events.length) { events = evs; session_id = evs[0]?.session_id; }
  }
  const tools = events.filter(e => e.event === 'tool' && e.tool_name && classify(e.tool_name));
  const firstWrite = tools.findIndex(e => classify(e.tool_name!) === 'write');
  let injected = 0;
  const log = join(wd, '.headstart', 'headstart.log');
  if (existsSync(log)) for (const m of readFileSync(log, 'utf8').matchAll(/chars=(\d+)/g)) injected += Number(m[1]);
  return { tool_calls: tools.length, discovery_calls: firstWrite < 0 ? tools.length : firstWrite, injected_chars: injected, session_id };
}

function check(o: EvalOpts, t: Task, wd: string): boolean {
  const candidates = [resolve(o.tasks, '..', t.hidden_test), resolve(o.tasks, '..', '..', t.hidden_test), resolve(t.hidden_test)];
  const src = candidates.find(existsSync);
  if (!src) throw new Error(`hidden test not found: ${t.hidden_test}`);
  const dst = join(wd, 'test', `hidden-${basename(t.hidden_test)}`);
  cpSync(src, dst);
  const r = sh('node', ['--test', dst], wd, { APP_ENV: 'test', APP_SEED: 'fixture' }, 120_000);
  return r.status === 0;
}

async function one(o: EvalOpts, t: Task, arm: Arm, r: number): Promise<Run> {
  const wd = prepareWorkdir(o, t, arm, r);
  const env = hookEnv(o, t, arm);
  const prompt = `${t.prompt}\n\nWork in this repository. Make the change, make sure it works, then stop. Do not ask questions.`;
  const t0 = Date.now();
  const rr = o.runner === 'devin' ? await runDevin(prompt, wd, env, o.model, o.timeoutMs) : await runClaude(prompt, wd, env, o.model, o.timeoutMs);
  const duration_s = (Date.now() - t0) / 1000;
  writeFileSync(join(wd, '.headstart', 'runner-output.json'), rr.raw);
  const ts = traceStats(wd);
  const pass = check(o, t, wd);
  return {
    task: t.id, shape: t.shape, arm, repeat: r, runner: o.runner, model: o.model,
    input_tokens: rr.input, cache_read: rr.cacheRead, cache_create: rr.cacheCreate, output_tokens: rr.output,
    context_tokens: rr.input + rr.cacheRead + rr.cacheCreate,
    turns: rr.turns, tool_calls: ts.tool_calls, discovery_calls: ts.discovery_calls, duration_s: Math.round(duration_s),
    cost_usd: rr.cost, pass, injected_chars: ts.injected_chars, error: rr.error, session_id: ts.session_id ?? rr.sessionId, workdir: wd,
  };
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) await fn(items[i++]); });
  await Promise.all(workers);
}

export async function runEval(o: EvalOpts): Promise<string> {
  mkdirSync(o.out, { recursive: true });
  let tasks = JSON.parse(readFileSync(o.tasks, 'utf8')) as Task[];
  if (o.only?.length) tasks = tasks.filter(t => o.only!.includes(t.id));
  const runsFile = join(o.out, 'runs.jsonl');
  const done = new Set(existsSync(runsFile) ? readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).map(l => { const j = JSON.parse(l); return `${j.task}-${j.arm}-${j.repeat}`; }) : []);
  const log = (s: string) => { process.stderr.write(s + '\n'); appendFileSync(join(o.out, 'eval.log'), `${new Date().toISOString()} ${s}\n`); };
  const record = async (t: Task, arm: Arm, r: number) => {
    const key = `${t.id}-${arm}-${r}`;
    if (done.has(key)) return;
    log(`start ${key}`);
    const run = await one(o, t, arm, r);
    appendFileSync(runsFile, JSON.stringify(run) + '\n');
    log(`done  ${key} pass=${run.pass} tools=${run.tool_calls} disc=${run.discovery_calls} ctx=${run.context_tokens} s=${run.duration_s} $${run.cost_usd.toFixed(3)}${run.error ? ' ERR ' + run.error : ''}`);
  };
  // Cold runs first: they are the only runs that write procedures, and every
  // warm arm recalls from them (never from the same task, see HEADSTART_EXCLUDE_TASK).
  if (o.arms.includes('cold')) {
    await pool(tasks.map(t => ({ t, r: 1 })), o.parallel, ({ t, r }) => record(t, 'cold', r));
    const more: { t: Task; r: number }[] = [];
    for (let r = 2; r <= o.repeats; r++) for (const t of tasks) more.push({ t, r });
    await pool(more, o.parallel, ({ t, r }) => record(t, 'cold', r));
  }
  const rest: { t: Task; arm: Arm; r: number }[] = [];
  for (const arm of o.arms.filter(a => a !== 'cold')) for (let r = 1; r <= o.repeats; r++) for (const t of tasks) rest.push({ t, arm, r });
  await pool(rest, o.parallel, ({ t, arm, r }) => record(t, arm, r));
  return runsFile;
}
