import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  if (process.env.HEADSTART_BACKEND === 'memorable') memorableIngest(cwd, pr);
}

export function appendLog(cwd: string, line: string): void {
  try { appendFileSync(join(stateDir(cwd), 'headstart.log'), `${new Date().toISOString()} ${line}\n`); } catch {}
}

// Optional adapter. Off unless HEADSTART_BACKEND=memorable. memorable-cli is a
// pre-event dependency and is disclosed as such in the submission.
function memorableIngest(cwd: string, pr: Procedure): void {
  const trace = {
    session_id: pr.session_id,
    task: pr.prompt,
    tool_calls: pr.steps.map(s => ({ name: s.cls, input: s.command ? { command: s.command } : { path: s.target }, ok: true })),
  };
  const tmp = join(stateDir(cwd), `ingest-${pr.id}.json`);
  writeFileSync(tmp, JSON.stringify(trace));
  spawnSync('memorable', ['ingest', tmp], { cwd, stdio: 'ignore', timeout: 20_000 });
}
