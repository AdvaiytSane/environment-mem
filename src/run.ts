import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { claudeFormatHooks } from './install.ts';
import { api, extractRemote, pendingPath, readPending } from './api.ts';
import type { Task } from './eval.ts';

// One live agent session, or a plan of them. Every run is a real Claude Code
// or Devin CLI process in its own copy of a repo, with the hooks installed,
// writing traces to <live>/<lane>/.headstart and procedures to one shared
// store. The console watches <live> and draws one lane per run. Nothing here
// decides what gets recalled: the hook does, the same way it does in a
// terminal.

export type Agent = 'claude' | 'devin';
export interface RunSpec {
  lane: string; agent: Agent; task: string; taskId?: string;
  inject?: 'full' | 'facts' | '0'; record?: boolean; model?: string; repo?: string; timeoutMin?: number;
}
export interface RunResult {
  lane: string; agent: Agent; taskId: string; sessionId?: string; calls: number; discovery: number;
  handed: { n: number; from: Array<{ harness?: string; task_id?: string; created_at?: string }>; agree?: unknown } | null;
  stored: boolean; durationS: number; pushed?: string; error?: string;
  cost: Cost;
  verification: { status: 'passed' | 'failed' | 'not_run'; reason?: string };
}
export interface Plan { live?: string; store?: string; repo?: string; model?: string; /** task files, merged; default fixtures/tasks.json */ tasks?: string[]; waves: RunSpec[][] }

const CLI = resolve(new URL('./cli.ts', import.meta.url).pathname);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function loadTasks(...files: string[]): Task[] {
  return (files.length ? files : ['fixtures/tasks.json']).flatMap(f => JSON.parse(readFileSync(resolve(f), 'utf8')) as Task[]);
}
export function resolveTask(spec: RunSpec, tasks: Task[]): { id: string; prompt: string } {
  const byId = tasks.find(t => t.id === spec.taskId || t.id === spec.task);
  if (byId) return { id: byId.id, prompt: byId.prompt };
  return { id: spec.taskId ?? slug(spec.task), prompt: spec.task };
}

/** A fresh copy of the repo for this lane, hooks installed, one git commit. */
export function prepareLane(live: string, lane: string, repo: string): string {
  const wd = join(live, lane);
  rmSync(wd, { recursive: true, force: true });
  cpSync(repo, wd, { recursive: true, filter: p => !p.includes('/.git') && !p.includes('/.headstart') && !p.includes('/node_modules') });
  mkdirSync(join(wd, '.claude'), { recursive: true });
  writeFileSync(join(wd, '.claude', 'settings.json'), JSON.stringify({ hooks: claudeFormatHooks(`node ${CLI}`) }, null, 2));
  const sh = (args: string[]) => spawnSync('git', args, { cwd: wd, encoding: 'utf8' });
  sh(['init', '-q']); sh(['add', '-A']); sh(['-c', 'user.email=live@headstart', '-c', 'user.name=live', 'commit', '-q', '-m', 'start']);
  return wd;
}

export interface Cost { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; model?: string; duration_ms?: number; dollars?: number }
function spawnAgent(agent: Agent, prompt: string, wd: string, env: NodeJS.ProcessEnv, model: string | undefined, timeoutMs: number, onOut: (s: string) => void): Promise<{ code: number | null; sessionId?: string; err: string; cost: Cost; failure?: string }> {
  return new Promise(res => {
    const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
    delete childEnv.CLAUDECODE; delete childEnv.CLAUDE_CODE_ENTRYPOINT;
    let args: string[];
    if (agent === 'claude') {
      args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
      if (model) args.push('--model', model);
    } else {
      mkdirSync(join(wd, '.headstart'), { recursive: true });
      args = ['-p', prompt, '--permission-mode', 'dangerous', '--respect-workspace-trust', 'false', '--export', join(wd, '.headstart', 'devin-export.json')];
      if (model) args.push('--model', model);
    }
    const grouped = process.platform !== 'win32';
    const child = spawn(agent, args, { cwd: wd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: grouped });
    let out = '', err = '', sessionId: string | undefined, spawnError: string | undefined, timedOut = false;
    child.on('error', e => { spawnError = (e as NodeJS.ErrnoException).code === 'ENOENT' ? `${agent} is not installed or is not on PATH` : `${agent} could not start: ${e.message}`; });
    child.stdout.on('data', d => { const s = String(d); out += s; onOut(s); const m = s.match(/"session_id"\s*:\s*"([^"]+)"/); if (m) sessionId = m[1]; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      try { if (grouped && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const cost: Cost = { model };
      try {
        if (agent === 'claude') {
          const last = out.trim().split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l)).filter(j => j.type === 'result').pop();
          const u = last?.usage ?? {};
          cost.input_tokens = u.input_tokens; cost.cached_input_tokens = u.cache_read_input_tokens; cost.output_tokens = u.output_tokens; cost.dollars = last?.total_cost_usd;
          if (last?.session_id) sessionId = last.session_id;
        } else {
          const m = JSON.parse(readFileSync(join(wd, '.headstart', 'devin-export.json'), 'utf8')).final_metrics ?? {};
          // Missing export fields mean unknown, not a zero-token run.
          const count = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
          if (count(m.total_cached_tokens)) cost.cached_input_tokens = m.total_cached_tokens;
          if (count(m.total_prompt_tokens) && count(m.total_cached_tokens) && m.total_prompt_tokens >= m.total_cached_tokens) cost.input_tokens = m.total_prompt_tokens - m.total_cached_tokens;
          if (count(m.total_completion_tokens)) cost.output_tokens = m.total_completion_tokens;
        }
      } catch {}
      const failure = spawnError ?? (timedOut ? `timed out after ${timeoutMs}ms` : signal ? `terminated by ${signal}` : code !== 0 ? `exit ${code}: ${err.slice(0, 300)}` : undefined);
      res({ code, sessionId, err: err.slice(0, 300), cost, failure });
    });
  });
}

/** What the hook wrote for this lane: the trace counts, the hand-off receipt, the store line. */
export function laneOutcome(wd: string): Pick<RunResult, 'sessionId' | 'calls' | 'discovery' | 'handed' | 'stored'> {
  const dir = join(wd, '.headstart', 'sessions');
  let events: Array<{ event: string; tool_name?: string; session_id?: string }> = [];
  if (existsSync(dir)) for (const f of readdirSync(dir)) {
    const evs = readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    if (evs.length > events.length) events = evs;
  }
  let calls = 0, discovery = 0, edited = false;
  for (const e of events) {
    if (e.event !== 'tool' || !e.tool_name) continue;
    if (/todo|skill|task|ask_user/i.test(e.tool_name)) continue;
    calls++;
    const write = /edit|write|patch|create/i.test(e.tool_name) && !/read/i.test(e.tool_name);
    if (write && !edited) { edited = true; discovery = calls - 1; }
    if (!edited) discovery = calls;
  }
  const logPath = join(wd, '.headstart', 'headstart.log');
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const handoffLine = log.split('\n').filter(l => l.includes('"handoff":1')).pop();
  let handed: RunResult['handed'] = null;
  if (handoffLine) { try { const r = JSON.parse(handoffLine.slice(handoffLine.indexOf('{'))); handed = { n: r.n, from: r.from ?? [], agree: r.agree }; } catch {} }
  return { sessionId: events[0]?.session_id, calls, discovery, handed, stored: /\bstored \S+ steps=/.test(log) };
}

export async function runOne(spec: RunSpec, opts: { live: string; store: string; repo: string; tasks: Task[]; model?: string; onOut?: (lane: string, s: string) => void }): Promise<RunResult> {
  if (!['claude', 'devin'].includes(spec.agent)) throw new Error('agent must be claude or devin');
  const { id, prompt } = resolveTask(spec, opts.tasks);
  const wd = prepareLane(opts.live, spec.lane, spec.repo ?? opts.repo);
  const env: NodeJS.ProcessEnv = {
    HEADSTART_STORE: resolve(opts.store), HEADSTART_REPO: 'live', HEADSTART_TASK_ID: id,
    HEADSTART_INJECT: spec.inject ?? 'full', HEADSTART_RECORD: spec.record === false ? '0' : '1',
    HEADSTART_DEFER_EXTRACT: '1',
  };
  const t0 = Date.now();
  const r = await spawnAgent(spec.agent, prompt, wd, env, spec.model ?? opts.model, (spec.timeoutMin ?? 12) * 60_000, s => opts.onOut?.(spec.lane, s));
  const durationS = Math.round((Date.now() - t0) / 1000);
  const task = opts.tasks.find(t => t.id === id);
  let verification: RunResult['verification'] = { status: 'not_run', reason: r.failure ? 'agent did not complete' : 'no independent check defined for this task' };
  if (!r.failure && task?.hidden_test) {
    const source = resolve(task.hidden_test);
    if (existsSync(source)) {
      const target = join(wd, 'test', `hidden-${basename(source)}`);
      mkdirSync(join(wd, 'test'), { recursive: true });
      cpSync(source, target);
      // Also run the task's original failing check from the untouched
      // fixture rather than trusting agent edits to verification code.
      const checks = [target];
      if (task.visible_failing_test) {
        const visibleSource = resolve(spec.repo ?? opts.repo, task.visible_failing_test);
        if (existsSync(visibleSource)) {
          const visibleTarget = join(wd, 'test', `verification-${basename(visibleSource)}`);
          cpSync(visibleSource, visibleTarget); checks.push(visibleTarget);
        }
      }
      const checkEnv: NodeJS.ProcessEnv = { ...process.env, APP_ENV: 'test', APP_SEED: 'fixture' };
      delete checkEnv.NODE_TEST_CONTEXT;
      const checked = spawnSync(process.execPath, ['--test', ...checks], { cwd: wd, env: checkEnv, encoding: 'utf8', timeout: 120_000 });
      verification = { status: checked.status === 0 ? 'passed' : 'failed', reason: checked.status === 0 ? undefined : 'independent fixture check failed or timed out' };
      writeFileSync(join(wd, '.headstart', 'verification.log'), `${checked.stdout ?? ''}${checked.stderr ?? ''}`);
    } else verification = { status: 'not_run', reason: 'independent check file unavailable' };
  }
  const o = laneOutcome(wd);
  let pushed: string | undefined, pushError: string | undefined;
  const a = api();
  if (a && o.sessionId && spec.record !== false) {
    // The hook left the payload; the runner knows what the session cost.
    try {
      const payload = readPending(pendingPath(wd, o.sessionId));
      payload.cost = { ...payload.cost, ...Object.fromEntries(Object.entries(r.cost).filter(([, v]) => v !== undefined)) };
      const pr = await extractRemote(a, payload, resolve(opts.store));
      if (pr.ok) pushed = pr.admitted ? pr.workflow_id : `${pr.workflow_id} (not admitted)`; else pushError = pr.error;
    } catch (e) { pushError = String((e as Error).message); }
  }
  const result: RunResult = { lane: spec.lane, agent: spec.agent, taskId: id, ...o, sessionId: o.sessionId ?? r.sessionId, durationS, cost: r.cost, verification, pushed, error: r.failure ?? (verification.status === 'failed' ? verification.reason : pushError ? `push: ${pushError}` : undefined) };
  mkdirSync(join(wd, '.headstart'), { recursive: true });
  writeFileSync(join(wd, '.headstart', 'run-result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

export function describe(r: RunResult): string {
  const from = r.handed ? r.handed.from.map(f => `${f.harness ?? 'unknown'} ${f.task_id ?? ''}`.trim()).slice(0, 3).join(', ') : '';
  const handed = r.handed ? `handed ${r.handed.n} (${from})` : 'cold';
  return `${r.lane.padEnd(14)} ${r.agent.padEnd(6)} ${r.taskId.padEnd(12)} ${String(r.calls).padStart(3)} calls ${String(r.discovery).padStart(3)} before first edit  ${String(r.durationS).padStart(4)}s  ${handed}${r.stored ? '  stored' : ''}${r.pushed ? '  hosted' : ''}  check=${r.verification.status}${r.error ? '  ' + r.error : ''}`;
}

/** Waves run in order; runs inside a wave run at once. Wave two recalls what wave one stored. */
export async function orchestrate(plan: Plan, opts: { tasks: Task[]; onOut?: (lane: string, s: string) => void; onDone?: (r: RunResult) => void }): Promise<RunResult[]> {
  const live = resolve(plan.live ?? 'results/live');
  const store = resolve(plan.store ?? join(live, 'store.jsonl'));
  const repo = resolve(plan.repo ?? 'fixtures/repo');
  mkdirSync(live, { recursive: true });
  const all: RunResult[] = [];
  for (const wave of plan.waves) {
    const rs = await Promise.all(wave.map(spec => runOne(spec, { live, store, repo, tasks: opts.tasks, model: plan.model, onOut: opts.onOut }).then(r => { opts.onDone?.(r); return r; })));
    all.push(...rs);
  }
  return all;
}
