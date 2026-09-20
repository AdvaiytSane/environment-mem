import { spawn } from 'node:child_process';
import { metadataClient, type MetadataDefinition, type MetadataClient } from './metadata.ts';
export type { MetadataRole, MetadataDefinition, MetadataClient, MemoryStoreRequest, MemoryRecallRequest, MemoryReceipt, MemoryRecallResult, MemoryMatch } from './metadata.ts';

export interface ToolCall {
  name: string;
  input: unknown;
  result?: { ok?: boolean; exit_code?: number };
}

/** The public Memorable CLI ingest envelope. Use the metadata overload below for explicit trace storage. */
export interface StoreRequest {
  session_id: string;
  workflow_id?: string;
  task_description: string;
  prompt?: string;
  harness: string;
  tool_calls: ToolCall[];
}

export type RecallRequest =
  | { query: string; mode?: 'auto' | 'single' | 'chain'; procedureId?: never }
  | { procedureId: string; query?: never; mode?: never };

export interface CommandResult {
  transport: 'cli';
  operation: 'store' | 'recall';
  /** A zero exit is not a durable storage receipt or a relevance verdict. */
  status: 'command_completed';
  exitCode: 0;
  stdout: string;
  stderr: string;
  format: 'text';
}

export interface CallOptions { signal?: AbortSignal }

export interface MemorableOptions {
  /** Executable path, not a shell command. Defaults to memorable on PATH. */
  command?: string;
  /** Prefix arguments, e.g. ["/path/to/cli.js"] when command is node. */
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export class MemorableCommandError extends Error {
  readonly code: 'spawn_failed' | 'exit_nonzero' | 'timeout' | 'output_limit' | 'aborted';
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(code: MemorableCommandError['code'], message: string, detail: {
    exitCode?: number | null; stdout?: string; stderr?: string;
  } = {}) {
    super(message);
    this.name = 'MemorableCommandError';
    this.code = code;
    this.exitCode = detail.exitCode ?? null;
    this.stdout = detail.stdout ?? '';
    this.stderr = detail.stderr ?? '';
  }
}

function nonempty(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new TypeError(`${name} must be a nonempty string without NUL bytes`);
  }
}

function identifier(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._][A-Za-z0-9._-]{0,199}$/.test(value)) {
    throw new TypeError(`${name} must be 1–200 letters, numbers, dots, underscores, or hyphens, without a leading hyphen`);
  }
}

function envelope(trace: StoreRequest): string {
  if (!trace || typeof trace !== 'object') throw new TypeError('store requires a trace');
  identifier(trace.session_id, 'session_id');
  nonempty(trace.task_description, 'task_description');
  nonempty(trace.harness, 'harness');
  if (trace.workflow_id !== undefined) {
    identifier(trace.workflow_id, 'workflow_id');
  }
  if (trace.prompt !== undefined && typeof trace.prompt !== 'string') throw new TypeError('prompt must be a string');
  if (!Array.isArray(trace.tool_calls) || !trace.tool_calls.length || trace.tool_calls.length > 2000) {
    throw new TypeError('tool_calls must contain 1–2000 completed tool calls');
  }
  const calls = trace.tool_calls.map((call, i) => {
    nonempty(call?.name, `tool_calls[${i}].name`);
    if (call.input === undefined) throw new TypeError(`tool_calls[${i}].input is required`);
    let result: ToolCall['result'];
    if (call.result !== undefined) {
      if (!call.result || typeof call.result !== 'object' || Array.isArray(call.result)) {
        throw new TypeError(`tool_calls[${i}].result must be an outcome object`);
      }
      if (call.result.ok !== undefined && typeof call.result.ok !== 'boolean') throw new TypeError('result.ok must be boolean');
      if (call.result.exit_code !== undefined && !Number.isInteger(call.result.exit_code)) throw new TypeError('result.exit_code must be an integer');
      if (call.result.ok !== undefined && call.result.exit_code !== undefined
        && call.result.ok !== (call.result.exit_code === 0)) throw new TypeError('result.ok conflicts with result.exit_code');
      result = {
        ...(call.result.ok === undefined ? {} : { ok: call.result.ok }),
        ...(call.result.exit_code === undefined ? {} : { exit_code: call.result.exit_code }),
      };
    }
    return { name: call.name, input: call.input, ...(result === undefined ? {} : { result }) };
  });
  // Only the documented envelope leaves this adapter; the CLI performs its
  // own argument allowlisting and identifier/credential scrubbing before egress.
  const json = JSON.stringify({
    session_id: trace.session_id,
    ...(trace.workflow_id === undefined ? {} : { workflow_id: trace.workflow_id }),
    task_description: trace.task_description,
    ...(trace.prompt === undefined ? {} : { prompt: trace.prompt }),
    harness: trace.harness,
    tool_calls: calls,
  });
  if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new RangeError('trace exceeds the 8 MB ingest limit');
  return json;
}

export interface MetadataMemorableOptions extends MemorableOptions {
  metadata: MetadataDefinition;
  embedding?: 'required' | 'optional' | 'off';
}
export interface LegacyMemorableClient {
  store(trace: StoreRequest, call?: CallOptions): Promise<CommandResult>;
  recall(request: RecallRequest, call?: CallOptions): Promise<CommandResult>;
}
/** A connection to the existing CLI, not a replacement retrieval engine. */
export function createMemorable(options: MetadataMemorableOptions): MetadataClient;
export function createMemorable(options?: MemorableOptions): LegacyMemorableClient;
export function createMemorable(options: MemorableOptions | MetadataMemorableOptions = {}): MetadataClient | LegacyMemorableClient {
  const command = options.command ?? 'memorable';
  nonempty(command, 'command');
  const prefix = options.args ?? [];
  if (!Array.isArray(prefix) || prefix.some(a => typeof a !== 'string' || a.includes('\0'))) throw new TypeError('args must be strings without NUL bytes');
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? ('metadata' in options ? 2_000_000 : 1024 * 1024);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be positive');
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) throw new TypeError('maxOutputBytes must be a positive integer');

  function run(operation: CommandResult['operation'], args: string[], input: string, call: CallOptions): Promise<CommandResult> {
    if (call.signal?.aborted) return Promise.reject(new MemorableCommandError('aborted', 'Memorable call aborted'));
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...prefix, ...args], {
        cwd: options.cwd,
        env: 'metadata' in options
          ? Object.fromEntries(Object.entries({ ...process.env, ...options.env }).filter(([key, value]) => value !== undefined &&
              (key.startsWith('MEMORABLE_') || ['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'TMP', 'TEMP', 'TMPDIR', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'].includes(key))))
          : { ...process.env, NO_COLOR: '1', ...options.env },
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const output: Buffer[] = [];
      const errors: Buffer[] = [];
      let size = 0;
      let reason: MemorableCommandError['code'] | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const terminate = (signal: NodeJS.Signals) => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch { /* The process/group may already have exited. */ }
      };
      const stop = (why: MemorableCommandError['code']) => {
        if (reason) return;
        reason = why;
        terminate('SIGTERM');
        killTimer = setTimeout(() => {
          terminate('SIGKILL');
          child.stdout.destroy();
          child.stderr.destroy();
          child.stdin.destroy();
          finish(null, null);
        }, 500);
      };
      const collect = (chunks: Buffer[], chunk: Buffer) => {
        const room = Math.max(0, maxOutputBytes - size);
        if (room) chunks.push(chunk.subarray(0, room));
        size += chunk.length;
        if (size > maxOutputBytes) stop('output_limit');
      };
      child.stdout.on('data', chunk => collect(output, Buffer.from(chunk)));
      child.stderr.on('data', chunk => collect(errors, Buffer.from(chunk)));
      const timer = setTimeout(() => stop('timeout'), timeoutMs);
      const aborted = () => stop('aborted');
      call.signal?.addEventListener('abort', aborted, { once: true });
      if (call.signal?.aborted) aborted();
      const cleanup = () => {
        clearTimeout(timer);
        // Keep the bounded group cleanup after cancellation even if the
        // direct child exits before a descendant releases inherited pipes.
        if (killTimer && !reason) clearTimeout(killTimer);
        call.signal?.removeEventListener('abort', aborted);
      };
      child.on('error', error => {
        cleanup();
        if (settled) return;
        settled = true;
        reject(new MemorableCommandError('spawn_failed', `Could not start Memorable: ${error.message}`));
      });
      // Early process exit can close stdin before the complete trace is read.
      // The process exit is authoritative; avoid an unhandled EPIPE exception.
      child.stdin.on('error', () => {});
      const finish = (exitCode: number | null, signal: string | null) => {
        cleanup();
        if (settled) return;
        settled = true;
        const stdout = Buffer.concat(output).toString('utf8');
        const stderr = Buffer.concat(errors).toString('utf8');
        if (reason || exitCode !== 0) {
          reject(new MemorableCommandError(reason ?? 'exit_nonzero',
            `Memorable ${operation} did not complete (${reason ?? signal ?? `exit ${exitCode}`}); a store may already have side effects`,
            { exitCode, stdout, stderr }));
          return;
        }
        resolve({ transport: 'cli', operation, status: 'command_completed', exitCode: 0, stdout, stderr, format: 'text' });
      };
      child.on('close', finish);
      child.stdin.end(input);
    });
  }

  if ('metadata' in options) return metadataClient({ metadata: options.metadata, embedding: options.embedding }, run);

  return {
    async store(trace: StoreRequest, call: CallOptions = {}): Promise<CommandResult> {
      return run('store', ['ingest', '-'], envelope(trace), call);
    },
    async recall(request: RecallRequest, call: CallOptions = {}): Promise<CommandResult> {
      if (!request || typeof request !== 'object') throw new TypeError('recall requires a query or procedureId');
      if ('procedureId' in request && request.procedureId !== undefined) {
        nonempty(request.procedureId, 'procedureId');
        if (request.query !== undefined || request.mode !== undefined) throw new TypeError('procedureId cannot be combined with query or mode');
        if (!/^[A-Za-z0-9_./-]+$/.test(request.procedureId) || request.procedureId.startsWith('-')) throw new TypeError('invalid procedureId');
        return run('recall', ['show', request.procedureId], '', call);
      }
      nonempty(request.query, 'query');
      const mode = request.mode ?? 'auto';
      if (!['auto', 'single', 'chain'].includes(mode)) throw new TypeError('mode must be auto, single, or chain');
      // A leading space keeps a task such as "--chain" literal: the released
      // CLI filters argv entries beginning with -- instead of parsing --.
      return run('recall', ['recall', ...(mode === 'auto' ? [] : [`--${mode}`]), ` ${request.query}`], '', call);
    },
  };
}
