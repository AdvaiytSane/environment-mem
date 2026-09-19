import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

type HookMap = Record<string, { matcher?: string; hooks: { type: 'command'; command: string }[] }[]>;

export function binCommand(): string {
  return process.env.HEADSTART_BIN ?? 'headstart';
}

export function claudeFormatHooks(bin: string): HookMap {
  const one = (event: string) => [{ matcher: '', hooks: [{ type: 'command' as const, command: `${bin} hook ${event}` }] }];
  return {
    SessionStart: one('SessionStart'),
    UserPromptSubmit: one('UserPromptSubmit'),
    PostToolUse: one('PostToolUse'),
    Stop: one('Stop'),
  };
}

function mergeJson(path: string, patch: (j: any) => any): void {
  let j: any = {};
  if (existsSync(path)) { try { j = JSON.parse(readFileSync(path, 'utf8')); } catch { j = {}; } }
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(patch(j), null, 2) + '\n');
}

function stripOurs(list: any[] | undefined, bin: string): any[] {
  return (list ?? []).filter(g => !(g.hooks ?? []).some((h: any) => String(h.command ?? '').startsWith(`${bin} hook`)));
}

export interface Target { name: string; path: string; present: boolean }

export function detect(cwd: string): Target[] {
  const has = (cmd: string) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
  return [
    { name: 'claude', path: join(cwd, '.claude', 'settings.json'), present: has('claude') },
    // Verified on devin 3000.10.31: the project .claude/settings.json fires,
    // .devin/hooks.v1.json did not in an untrusted workspace. User-level
    // ~/.config/devin/config.json also fires; written only with --all.
    { name: 'devin', path: join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'devin', 'config.json'), present: has('devin') },
    { name: 'codex', path: join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'hooks.json'), present: has('codex') },
  ];
}

// Devin CLI reads the project .claude/settings.json as well, so the Claude
// file alone covers Devin. The other targets are user-level and opt-in.
export function install(cwd: string, opts: { targets?: string[]; force?: boolean } = {}): string[] {
  const bin = binCommand();
  const hooks = claudeFormatHooks(bin);
  const written: string[] = [];
  for (const t of detect(cwd)) {
    if (opts.targets && !opts.targets.includes(t.name)) continue;
    if (!opts.targets && t.name !== 'claude') continue;
    mergeJson(t.path, j => {
      j.hooks = j.hooks ?? {};
      for (const [ev, groups] of Object.entries(hooks)) j.hooks[ev] = [...stripOurs(j.hooks[ev], bin), ...groups];
      return j;
    });
    written.push(t.path);
  }
  return written;
}

export function uninstall(cwd: string): string[] {
  const bin = binCommand();
  const removed: string[] = [];
  for (const t of detect(cwd)) {
    if (!existsSync(t.path)) continue;
    mergeJson(t.path, j => {
      for (const ev of Object.keys(j.hooks ?? {})) j.hooks[ev] = stripOurs(j.hooks[ev], bin);
      return j;
    });
    removed.push(t.path);
  }
  return removed;
}
