import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function stateDir(cwd: string): string {
  const dir = process.env.HEADSTART_STATE_DIR ?? join(cwd, '.headstart');
  mkdirSync(join(dir, 'sessions'), { recursive: true });
  return dir;
}

export function storePath(cwd: string): string {
  return process.env.HEADSTART_STORE ?? join(stateDir(cwd), 'procedures.jsonl');
}

export function sessionPath(cwd: string, sessionId: string): string {
  return join(stateDir(cwd), 'sessions', `${sessionId.replace(/[^\w.-]/g, '_')}.jsonl`);
}

export function repoName(cwd: string): string {
  if (process.env.HEADSTART_REPO) return process.env.HEADSTART_REPO;
  const cfg = join(cwd, '.git', 'config');
  if (existsSync(cfg)) {
    const m = readFileSync(cfg, 'utf8').match(/url\s*=\s*(.+)/);
    if (m) return m[1].trim().replace(/\.git$/, '').split(/[:/]/).slice(-2).join('/');
  }
  return basename(cwd);
}
