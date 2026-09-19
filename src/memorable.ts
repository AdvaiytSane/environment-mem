import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createMemorable, type StoreRequest, type CommandResult } from './sdk/index.ts';
import { stateDir } from './paths.ts';
import type { TraceEvent } from './types.ts';

export function backendFor(cwd: string): 'local' | 'memorable' {
  const file = join(stateDir(cwd), 'config.json');
  const configured = process.env.HEADSTART_BACKEND
    ?? (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).backend : 'local');
  if (configured !== 'local' && configured !== 'memorable') throw new Error('backend must be local or memorable');
  return configured;
}

export function memorableConnection(cwd: string, timeoutMs = 30_000) {
  const args = process.env.HEADSTART_MEMORABLE_ARGS ? JSON.parse(process.env.HEADSTART_MEMORABLE_ARGS) : [];
  return createMemorable({
    cwd, command: process.env.HEADSTART_MEMORABLE_BIN ?? 'memorable', args,
    timeoutMs,
  });
}

export function toMemorableTrace(events: TraceEvent[]): StoreRequest {
  const prompt = events.find(e => e.event === 'prompt' && e.prompt?.trim());
  if (!prompt?.prompt || !prompt.run_id) throw new Error('Memorable forwarding requires a prompt and a per-task run ID');
  // Hash the caller's IDs so the CLI cannot sanitize two distinct IDs into
  // the same workflow. This is a task identity, not a reusable definition ID.
  const workflow = 'env-' + createHash('sha256').update(`${prompt.session_id}\0${prompt.run_id}`).digest('hex').slice(0, 40);
  return {
    session_id: 'env-session-' + createHash('sha256').update(prompt.session_id).digest('hex').slice(0, 40),
    workflow_id: workflow,
    prompt: prompt.prompt,
    task_description: prompt.prompt,
    harness: process.env.HEADSTART_HARNESS ?? 'headstart',
    tool_calls: events.filter(e => e.event === 'tool').map(e => ({
      name: e.tool_name ?? 'unknown',
      input: e.tool_input ?? {},
      ...(e.result ? { result: e.result } : typeof e.ok === 'boolean' ? { result: { ok: e.ok } } : {}),
    })),
  };
}

interface Pending { hash: string; trace: StoreRequest }
interface Receipt { hash: string; status: 'command_completed' | 'failed'; at: string; errorCode?: string }
function rows<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function paths(cwd: string) {
  const base = stateDir(cwd);
  return { outbox: join(base, 'memorable-outbox.jsonl'), receipts: join(base, 'memorable-receipts.jsonl') };
}
function append(file: string, value: unknown) {
  appendFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600 });
}
export function pendingMemorable(cwd: string): Pending[] {
  const p = paths(cwd);
  const complete = new Set(rows<Receipt>(p.receipts).filter(r => r.status === 'command_completed').map(r => r.hash));
  const latest = new Map<string, Pending>();
  for (const row of rows<Pending>(p.outbox)) latest.set(row.trace.workflow_id!, row);
  return [...latest.values()].filter(row => !complete.has(row.hash));
}

async function deliver(cwd: string, item: Pending): Promise<CommandResult> {
  try {
    const result = await memorableConnection(cwd).store(item.trace);
    append(paths(cwd).receipts, { hash: item.hash, status: result.status, at: new Date().toISOString() } satisfies Receipt);
    return result;
  } catch (error) {
    append(paths(cwd).receipts, { hash: item.hash, status: 'failed', at: new Date().toISOString(),
      errorCode: String((error as { code?: string }).code ?? 'connection_error') } satisfies Receipt);
    throw error;
  }
}

export async function forwardMemorable(cwd: string, events: TraceEvent[]): Promise<CommandResult | null> {
  const trace = toMemorableTrace(events);
  const hash = createHash('sha256').update(JSON.stringify(trace)).digest('hex');
  const p = paths(cwd);
  if (rows<Receipt>(p.receipts).some(r => r.hash === hash && r.status === 'command_completed')) return null;
  if (!rows<Pending>(p.outbox).some(r => r.hash === hash)) append(p.outbox, { hash, trace });
  return deliver(cwd, { hash, trace });
}

/** Explicit retry; stable workflow IDs let Memorable apply its revision rules. */
export async function syncMemorable(cwd: string): Promise<CommandResult[]> {
  if (backendFor(cwd) !== 'memorable') throw new Error('sync requires the memorable backend');
  const results: CommandResult[] = [];
  const failures: unknown[] = [];
  for (const item of pendingMemorable(cwd)) {
    try { results.push(await deliver(cwd, item)); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) {
    throw new AggregateError(failures, `Memorable sync: ${results.length} commands completed; ${failures.length} failed and remain pending. Run connection to inspect the pending count.`);
  }
  return results;
}
