import { createHash } from 'node:crypto';
import type { Procedure, Step, TraceEvent } from './types.ts';
import { repoName } from './paths.ts';
import { succeeded, toSteps } from './trace.ts';

const MAX_STEPS = 40;

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'is', 'be', 'so', 'that', 'this', 'with', 'as', 'by', 'at', 'from', 'its', 'when', 'then', 'than', 'into', 'do', 'not', 'no', 'if', 'but', 'are', 'was', 'were', 'has', 'have', 'should', 'work', 'repository', 'make', 'sure', 'change', 'stop', 'ask', 'questions', 'works', 'only', 'one', 'n']);

export function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9_./-]+/).map(t => t.replace(/[.,:;]+$/, '')).filter(t => t.length > 1 && !STOP.has(t));
}

function uniq<T>(xs: T[]): T[] { return [...new Set(xs)]; }

/** The command a person would type to verify: pipes to tail/head, stderr
 * redirects, echo chains and stash dances stripped. Empty when nothing
 * checkable is left. */
export function verifyForm(command: string): string | null {
  let c = command.replace(/^cd\s+\S+\s*(&&|;)\s*/, '');
  if (/git stash/.test(c)) return null;
  c = c.split(/\s*(?:&&|;)\s*/)[0];
  c = c.replace(/\s*2>&1/g, '').replace(/\s*\|\s*(tail|head|grep|wc|cat|sed|awk)\b.*$/, '').trim();
  if (!c || /^(echo|printf|ls|cat|git (stash|status|diff|log))\b/.test(c)) return null;
  return c.slice(0, 120);
}

export function extract(events: TraceEvent[], cwd: string): Procedure | null {
  const prompts = events.filter(e => e.event === 'prompt' && e.prompt).map(e => e.prompt!.trim());
  const steps = toSteps(events, cwd);
  if (!steps.length) return null;
  const sessionId = events[0].session_id;

  const firstWrite = steps.findIndex(s => s.cls === 'write');
  const lastWrite = steps.map(s => s.cls).lastIndexOf('write');
  const before = firstWrite < 0 ? steps : steps.slice(0, firstWrite);
  const preconditions = uniq(before.filter(s => s.target && (s.cls === 'read' || s.cls === 'search'))
    .map(s => s.cls === 'search' ? `grep "${s.target}"` : s.target!)).slice(0, 12);

  const toolEvents = events.filter(e => e.event === 'tool');
  const okCommands = new Set(
    toolEvents.filter(e => succeeded(e) && e.tool_input && typeof e.tool_input.command === 'string')
      .map(e => (e.tool_input!.command as string).replace(/\s+/g, ' ').trim().slice(0, 200)),
  );
  const after = lastWrite < 0 ? [] : steps.slice(lastWrite + 1);
  const postconditions = uniq(after.filter(s => s.command && okCommands.has(s.command)).map(s => verifyForm(s.command!)).filter(Boolean) as string[]).slice(-2);

  const files_written = uniq(steps.filter(s => s.cls === 'write' && s.target).map(s => s.target!));
  const files_read = uniq(steps.filter(s => s.cls === 'read' && s.target).map(s => s.target!));
  const commands = uniq(steps.filter(s => s.command).map(s => s.command!));

  const prompt = prompts[0] ?? '';
  const title = (prompt || files_written.join(', ') || 'session').replace(/\s+/g, ' ').slice(0, 100);
  const search_text = uniq([
    ...tokenize(prompt),
    ...files_written.flatMap(f => tokenize(f)),
    ...files_read.flatMap(f => tokenize(f)),
    ...commands.flatMap(c => tokenize(c).slice(0, 4)),
  ]).join(' ');

  const trimmed: Step[] = steps.length > MAX_STEPS
    ? [...steps.slice(0, 10), ...steps.slice(firstWrite < 0 ? 10 : Math.max(10, firstWrite - 3)).slice(0, MAX_STEPS - 10)]
    : steps;

  return {
    id: createHash('sha1').update(sessionId + title).digest('hex').slice(0, 12),
    session_id: sessionId,
    task_id: process.env.HEADSTART_TASK_ID,
    repo: repoName(cwd),
    created_at: new Date().toISOString(),
    title,
    prompt: prompt.slice(0, 500),
    steps: trimmed.map((s, i) => ({ ...s, seq: i + 1 })),
    preconditions,
    postconditions,
    files_written,
    files_read,
    commands,
    discovery_calls: before.length,
    total_calls: steps.reduce((n, s) => n + (s.repeat ?? 1), 0),
    search_text,
  };
}
