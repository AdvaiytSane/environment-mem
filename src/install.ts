import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type HookMap = Record<string, { matcher?: string; hooks: { type: 'command'; command: string }[] }[]>;

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

function defaultBinCommand(): string {
  // Pin the runtime that is running this Node 24+ CLI and this checkout. A
  // native hook does not necessarily inherit an interactive shell's PATH.
  return `${shellQuote(process.execPath)} ${shellQuote(fileURLToPath(new URL('./cli.ts', import.meta.url)))}`;
}

export function binCommand(): string {
  const override = process.env.HEADSTART_BIN;
  if (override !== undefined) {
    if (!override.trim() || override.includes('\0')) throw new Error('HEADSTART_BIN must be a nonempty command without NUL bytes');
    return override;
  }
  return defaultBinCommand();
}

export function claudeFormatHooks(bin: string): HookMap {
  const one = (event: string) => [{ matcher: '', hooks: [{ type: 'command' as const, command: `${bin} hook ${event}` }] }];
  return {
    SessionStart: one('SessionStart'),
    UserPromptSubmit: one('UserPromptSubmit'),
    PostToolUse: one('PostToolUse'),
    PostToolUseFailure: one('PostToolUseFailure'),
    Stop: one('Stop'),
  };
}

function readSettings(path: string): any {
  let j: any = {};
  if (existsSync(path)) {
    const text = readFileSync(path, 'utf8');
    try { j = JSON.parse(text); }
    catch { throw new Error(`Refusing to change ${path}: settings contain invalid JSON`); }
  }
  const object = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const invalid = () => { throw new Error(`Refusing to change ${path}: settings contain an invalid hooks structure`); };
  if (!object(j)) invalid();
  if (j.hooks !== undefined) {
    if (!object(j.hooks)) invalid();
    for (const groups of Object.values(j.hooks)) {
      if (!Array.isArray(groups)) invalid();
      for (const group of groups as any[]) {
        if (!object(group) || !Array.isArray(group.hooks) || !group.hooks.every(object)) invalid();
      }
    }
  }
  return j;
}

function writeSettings(path: string, settings: any): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
}

function stripOurs(list: any[] | undefined, bin: string): any[] {
  // Recognize the original PATH-based installation as well as this checkout's
  // default and the explicit override. Never remove a whole mixed hook group.
  const commands = new Set([bin, defaultBinCommand(), 'headstart']);
  const ours = (hook: any) => typeof hook.command === 'string' && [...commands].some(command => {
    const prefix = `${command} hook `;
    return hook.command.startsWith(prefix) && /^[A-Za-z][A-Za-z0-9]*\s*$/.test(hook.command.slice(prefix.length));
  });
  return (list ?? []).flatMap(group => {
    const hooks = group.hooks.filter((hook: any) => !ours(hook));
    if (hooks.length === group.hooks.length) return [group];
    return hooks.length ? [{ ...group, hooks }] : [];
  });
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
  const updates: Array<{ path: string; settings: any }> = [];
  for (const t of detect(cwd)) {
    if (opts.targets && !opts.targets.includes(t.name)) continue;
    if (!opts.targets && t.name !== 'claude') continue;
    const settings = readSettings(t.path);
    settings.hooks = settings.hooks ?? {};
    for (const [ev, groups] of Object.entries(hooks)) {
      // Failure-event registration is documented for Claude. Do not assume
      // other harnesses accept the same event just because the payloads overlap.
      if (ev === 'PostToolUseFailure' && t.name !== 'claude') continue;
      settings.hooks[ev] = [...stripOurs(settings.hooks[ev], bin), ...groups];
    }
    updates.push({ path: t.path, settings });
  }
  // Preflight every target before the first write, so malformed settings in
  // another target cannot leave a partially installed set of hooks.
  for (const update of updates) writeSettings(update.path, update.settings);
  return updates.map(update => update.path);
}

export function uninstall(cwd: string): string[] {
  const bin = binCommand();
  const updates: Array<{ path: string; settings: any }> = [];
  for (const t of detect(cwd)) {
    if (!existsSync(t.path)) continue;
    const settings = readSettings(t.path);
    const before = JSON.stringify(settings);
    for (const ev of Object.keys(settings.hooks ?? {})) settings.hooks[ev] = stripOurs(settings.hooks[ev], bin);
    if (JSON.stringify(settings) !== before) updates.push({ path: t.path, settings });
  }
  for (const update of updates) writeSettings(update.path, update.settings);
  return updates.map(update => update.path);
}
