import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { TraceEvent } from './types.ts';
import { sessionPath } from './paths.ts';
import { extract } from './extract.ts';
import { appendLog, readAll, upsert } from './store.ts';
import { similar, repoFacts } from './recall.ts';
import { renderFacts, renderSimilar } from './inject.ts';

type Raw = Record<string, any>;

const EVENT_ALIASES: Record<string, string> = {
  sessionstart: 'SessionStart', userpromptsubmit: 'UserPromptSubmit', posttooluse: 'PostToolUse',
  pretooluse: 'PreToolUse', stop: 'Stop', sessionend: 'SessionEnd',
  start: 'SessionStart', prompt: 'UserPromptSubmit', tool: 'PostToolUse', end: 'Stop',
};

function eventName(argvEvent: string | undefined, raw: Raw): string {
  const n = argvEvent ?? raw.hook_event_name ?? raw.hookEventName ?? raw.event ?? '';
  return EVENT_ALIASES[String(n).toLowerCase()] ?? String(n);
}

function readStdin(): string {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function head(v: unknown, n = 300): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.slice(0, n);
}

function okOf(resp: unknown): boolean | undefined {
  if (resp && typeof resp === 'object') {
    const r = resp as Raw;
    if (typeof r.exit_code === 'number') return r.exit_code === 0;
    if (typeof r.exitCode === 'number') return r.exitCode === 0;
    if (typeof r.is_error === 'boolean') return !r.is_error;
    if (typeof r.success === 'boolean') return r.success;
  }
  return undefined;
}

export function runHook(argvEvent?: string): void {
  const text = readStdin();
  let raw: Raw = {};
  try { raw = text.trim() ? JSON.parse(text) : {}; } catch { raw = {}; }
  const event = eventName(argvEvent, raw);
  const cwd: string = raw.cwd ?? process.cwd();
  const sessionId: string = raw.session_id ?? raw.sessionId ?? process.env.HEADSTART_SESSION_ID ?? 'default';
  const file = sessionPath(cwd, sessionId);
  const mode = process.env.HEADSTART_INJECT ?? 'full';
  const inject = mode !== '0' && mode !== 'off';
  const injectProcedures = mode === 'full' || mode === '1';
  const record = process.env.HEADSTART_RECORD !== '0';
  const excludeTask = process.env.HEADSTART_EXCLUDE_TASK;
  const write = (ev: TraceEvent) => appendFileSync(file, JSON.stringify(ev) + '\n');
  const ts = Date.now();

  switch (event) {
    case 'SessionStart': {
      write({ ts, event: 'start', session_id: sessionId, cwd });
      if (!inject) return;
      const facts = repoFacts(cwd, excludeTask);
      if (!facts) return;
      const ctx = renderFacts(facts, cwd);
      appendLog(cwd, `inject start ${sessionId} chars=${ctx.length} sessions=${facts.sessions}`);
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } }));
      return;
    }
    case 'UserPromptSubmit': {
      const prompt: string = raw.prompt ?? raw.user_prompt ?? raw.message ?? '';
      write({ ts, event: 'prompt', session_id: sessionId, cwd, prompt });
      if (!inject || !injectProcedures || !prompt) return;
      const sim = similar(cwd, prompt, { k: 3, excludeTask });
      if (!sim) { appendLog(cwd, `recall miss ${sessionId}`); return; }
      const ctx = renderSimilar(sim);
      appendLog(cwd, `inject prompt ${sessionId} score=${sim.closest.score.toFixed(2)} chars=${ctx.length} from=${sim.closest.procedure.id} matches=${sim.n} ids=${sim.ids.join(',')} harnesses=${sim.harnesses.map(h => `${h.name}:${h.n}`).join(',')} recorded=${sim.closest.procedure.created_at}`);
      // The hand-off record: written by the sender, so the page never has to
      // search for a source. One JSON line, read by the live server.
      const all = readAll(cwd);
      const from = sim.ids.map(id => all.find(p => p.id === id)).filter(Boolean).map(p => ({ id: p!.id, harness: p!.harness ?? 'unknown', task_id: p!.task_id, created_at: p!.created_at, title: p!.title.slice(0, 80) }));
      const agree = sim.changed.filter(c => c.n >= Math.max(2, Math.ceil(sim.n / 2))).map(c => ({ file: c.name, n: c.n }));
      appendLog(cwd, JSON.stringify({ handoff: 1, session: sessionId, at: new Date().toISOString(), prompt: prompt.slice(0, 200), from, n: sim.n, agree, verify: sim.verify[0]?.name ?? null, discovery: sim.discovery, score: Number(sim.closest.score.toFixed(2)) }));
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } }));
      return;
    }
    case 'PostToolUse': {
      write({
        ts, event: 'tool', session_id: sessionId, cwd,
        tool_name: raw.tool_name ?? raw.toolName ?? raw.tool ?? 'unknown',
        tool_input: raw.tool_input ?? raw.toolInput ?? raw.input ?? {},
        ok: okOf(raw.tool_response ?? raw.toolResponse ?? raw.output),
        response_head: head(raw.tool_response ?? raw.toolResponse ?? raw.output),
      });
      return;
    }
    case 'Stop':
    case 'SessionEnd': {
      write({ ts, event: 'stop', session_id: sessionId, cwd });
      if (!record || !existsSync(file)) return;
      const events = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as TraceEvent);
      const pr = extract(events, cwd);
      if (!pr) return;
      upsert(cwd, pr);
      appendLog(cwd, `stored ${pr.id} steps=${pr.steps.length} discovery=${pr.discovery_calls} total=${pr.total_calls}`);
      return;
    }
    default:
      return;
  }
}
