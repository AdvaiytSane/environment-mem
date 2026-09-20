import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Optional packages implement this interface; core imposes no trace schema. */
export interface MemoryAdapter {
  recall(request: unknown, context: { signal: AbortSignal }): Promise<unknown>;
  store(request: unknown, context: { signal: AbortSignal }): Promise<unknown>;
}

export interface AdapterEnvelope {
  schema: 'memorable.adapter.v1';
  operation: 'recall' | 'store';
  result: unknown;
}

/** The path is executable code, chosen by the developer, never by trace data. */
export async function loadAdapter(modulePath: string, config: Record<string, unknown> = {}): Promise<MemoryAdapter> {
  if (!modulePath || /^[a-z][a-z0-9+.-]*:/i.test(modulePath)) throw new Error('adapter must be a local module path');
  const absolute = resolve(modulePath);
  if (!statSync(absolute).isFile()) throw new Error('adapter must be a local file');
  const module = await import(pathToFileURL(absolute).href);
  if (typeof module.createAdapter !== 'function') throw new Error('adapter must export createAdapter(config)');
  const adapter = await module.createAdapter(config);
  if (typeof adapter?.recall !== 'function' || typeof adapter?.store !== 'function') {
    throw new Error('adapter must implement recall and store');
  }
  return adapter;
}

export async function invokeAdapter(adapter: MemoryAdapter, operation: 'recall' | 'store', request: unknown,
  options: { timeoutMs?: number } = {}): Promise<AdapterEnvelope> {
  if (operation !== 'recall' && operation !== 'store') throw new Error('operation must be recall or store');
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('timeoutMs must be 1–120000');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      adapter[operation](request, { signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new Error('adapter operation timed out')); controller.abort(); }, timeoutMs);
      }),
    ]);
    const envelope: AdapterEnvelope = { schema: 'memorable.adapter.v1', operation, result: result ?? null };
    if (Buffer.byteLength(JSON.stringify(envelope)) > 2 * 1024 * 1024) throw new Error('adapter output exceeds 2 MiB');
    return envelope;
  } finally { if (timer) clearTimeout(timer); }
}

export async function adapterCommand(args: string[]): Promise<void> {
  const [operation, option, modulePath, ...extra] = args;
  if (!['recall', 'store'].includes(operation) || option !== '--adapter' || !modulePath || extra.length) {
    throw new Error('usage: headstart memory <recall|store> --adapter <local-module>');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 8 * 1024 * 1024) throw new Error('adapter input exceeds 8 MiB');
    chunks.push(buffer);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'request')) {
    throw new Error('stdin must contain {request, config?}');
  }
  if (body.config !== undefined && (!body.config || typeof body.config !== 'object' || Array.isArray(body.config))) {
    throw new Error('config must be an object');
  }
  const adapter = await loadAdapter(modulePath, body.config);
  const result = await invokeAdapter(adapter, operation as 'recall' | 'store', body.request);
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output) > 2 * 1024 * 1024) throw new Error('adapter output exceeds 2 MiB');
  process.stdout.write(output + '\n');
}
