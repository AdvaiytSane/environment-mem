import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { claudeFormatHooks } from './install.ts';
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
  stored: boolean; durationS: number; error?: string;
}
export interface Plan { live?: string; store?: string; repo?: string; model?: string; waves: RunSpec[][] }

const CLI = resolve(new URL('./cli.ts', import.meta.url).pathname);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function loadTasks(file = 'fixtures/tasks.json'): Task[] {
  return JSON.parse(readFileSync(resolve(file), 'utf8')) as Task[];
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

function spawnAgent(agent: Agent, prompt: string, wd: string, env: NodeJS.ProcessEnv, model: string | undefined, timeoutMs: number, onOut: (s: string) => void): Promise<{ code: number | null; sessionId?: string; err: string }> {
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
    const child = spawn(agent, args, { cwd: wd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', sessionId: string | undefined;
    child.stdout.on('data', d => { const s = String(d); out += s; onOut(s); const m = s.match(/"session_id"\s*:\s*"([^"]+)"/); if (m) sessionId = m[1]; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', code => { clearTimeout(timer); res({ code, sessionId, err: err.slice(0, 300) }); });
    void out;
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
  const { id, prompt } = resolveTask(spec, opts.tasks);
  const wd = prepareLane(opts.live, spec.lane, spec.repo ?? opts.repo);
  const env: NodeJS.ProcessEnv = {
    HEADSTART_STORE: resolve(opts.store), HEADSTART_REPO: 'live', HEADSTART_TASK_ID: id,
    HEADSTART_INJECT: spec.inject ?? 'full', HEADSTART_RECORD: spec.record === false ? '0' : '1',
  };
  const t0 = Date.now();
  const r = await spawnAgent(spec.agent, prompt, wd, env, spec.model ?? opts.model, (spec.timeoutMin ?? 12) * 60_000, s => opts.onOut?.(spec.lane, s));
  const o = laneOutcome(wd);
  return { lane: spec.lane, agent: spec.agent, taskId: id, ...o, sessionId: o.sessionId ?? r.sessionId, durationS: Math.round((Date.now() - t0) / 1000), error: r.code ? `exit ${r.code}: ${r.err}` : undefined };
}

export function describe(r: RunResult): string {
  const from = r.handed ? r.handed.from.map(f => `${f.harness ?? 'unknown'} ${f.task_id ?? ''}`.trim()).slice(0, 3).join(', ') : '';
  const handed = r.handed ? `handed ${r.handed.n} (${from})` : 'cold';
  return `${r.lane.padEnd(14)} ${r.agent.padEnd(6)} ${r.taskId.padEnd(12)} ${String(r.calls).padStart(3)} calls ${String(r.discovery).padStart(3)} before first edit  ${String(r.durationS).padStart(4)}s  ${handed}${r.stored ? '  stored' : ''}${r.error ? '  ' + r.error : ''}`;
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
