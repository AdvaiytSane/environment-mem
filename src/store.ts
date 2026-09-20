import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Procedure } from './types.ts';
import { stateDir, storePath } from './paths.ts';
import { join } from 'node:path';

export function readAll(cwd: string): Procedure[] {
  const p = storePath(cwd);
  if (!existsSync(p)) return [];
  const byId = new Map<string, Procedure>();
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const pr = JSON.parse(line) as Procedure; byId.set(pr.session_id, pr); } catch {}
  }
  return [...byId.values()];
}

export function upsert(cwd: string, pr: Procedure): void {
  const p = storePath(cwd);
  const rest = readAll(cwd).filter(x => x.session_id !== pr.session_id);
  writeFileSync(p, rest.concat(pr).map(x => JSON.stringify(x)).join('\n') + '\n');
}

export function appendLog(cwd: string, line: string): void {
  try { appendFileSync(join(stateDir(cwd), 'headstart.log'), `${new Date().toISOString()} ${line}\n`); } catch {}
}
