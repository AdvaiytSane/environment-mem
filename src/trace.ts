import type { Cls, Step, TraceEvent } from './types.ts';

const EXACT: Record<string, Cls> = {
  Bash: 'execute', exec: 'execute', shell: 'execute', run_command: 'execute', execute_command: 'execute',
  Read: 'read', read: 'read', read_file: 'read', view: 'read', view_file: 'read', cat: 'read',
  Grep: 'search', Glob: 'search', LS: 'search', grep: 'search', glob: 'search', find: 'search',
  search: 'search', list_dir: 'search', codebase_search: 'search',
  Edit: 'write', Write: 'write', MultiEdit: 'write', NotebookEdit: 'write', edit: 'write', write: 'write',
  apply_patch: 'write', create_file: 'write', write_file: 'write', str_replace_editor: 'write',
};

const SKIP = new Set(['TodoWrite', 'Task', 'Skill', 'AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode', 'todo', 'think', 'ask_user_question']);

export function classify(toolName: string): Cls | null {
  if (SKIP.has(toolName)) return null;
  if (EXACT[toolName]) return EXACT[toolName];
  if (toolName.startsWith('mcp__')) return 'other';
  const n = toolName.toLowerCase();
  if (/exec|bash|shell|command|terminal/.test(n)) return 'execute';
  if (/edit|write|patch|create|replace/.test(n)) return 'write';
  if (/grep|search|glob|find|list|ls\b/.test(n)) return 'search';
  if (/read|view|cat|open/.test(n)) return 'read';
  return 'other';
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length ? v : undefined;
}

export function targetOf(value: unknown, cwd: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const p = str(input.file_path) ?? str(input.path) ?? str(input.file) ?? str(input.notebook_path)
    ?? str(input.target_file) ?? str(input.pattern) ?? str(input.query);
  return p ? rel(p, cwd) : undefined;
}

export function commandOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const c = str(input.command) ?? str(input.cmd);
  return c ? c.replace(/\s+/g, ' ').trim().slice(0, 200) : undefined;
}

export function rel(p: string, cwd: string): string {
  if (p.startsWith(cwd + '/')) return p.slice(cwd.length + 1);
  return p;
}

export function succeeded(ev: TraceEvent): boolean {
  if (typeof ev.result?.exit_code === 'number' && ev.result.exit_code !== 0) return false;
  if (typeof ev.result?.ok === 'boolean') return ev.result.ok;
  if (typeof ev.result?.exit_code === 'number') return ev.result.exit_code === 0;
  if (typeof ev.ok === 'boolean') return ev.ok;
  return false;
}

const READ_CMDS = /^(cat|head|tail|less|more|bat|sed -n)\b/;
const SEARCH_CMDS = /^(grep|rg|ag|find|fd|ls|tree|wc|git (grep|ls-files|log|status|diff|show|branch))\b/;

/** A shell command that only looks at the repo is a read or a search, not
 * an execute. Its first path-like argument is the target. Pipelines and
 * chains count as their first command. */
export function shellClass(command: string, cwd: string): { cls: Cls; target?: string } | null {
  const first = command.split(/\s*(?:\|\||&&|;|\|)\s*/)[0].replace(/^cd\s+\S+\s*(&&|;)\s*/, '').trim();
  const kind = READ_CMDS.test(first) ? 'read' : SEARCH_CMDS.test(first) ? 'search' : null;
  if (!kind) return null;
  const args = first.split(/\s+/).slice(1).filter(a => !a.startsWith('-') && a !== '.' && !/^["']?\d+["']?$/.test(a));
  const paths = args.map(a => a.replace(/^["']|["']$/g, '')).filter(a => /[\w.-]+\.[a-z]{1,6}$|\//i.test(a) && !a.includes('*'));
  const target = paths.length ? rel(paths[0], cwd) : undefined;
  if (kind === 'search') {
    const m = first.match(/^(?:grep|rg|ag)\s+(?:-\S+\s+)*["']([^"']+)["']/) ?? first.match(/^(?:grep|rg|ag)\s+(?:-\S+\s+)*(\S+)/);
    return { cls: 'search', target: m ? m[1].slice(0, 60) : target };
  }
  return { cls: 'read', target };
}

export function toSteps(events: TraceEvent[], cwd: string): Step[] {
  const steps: Step[] = [];
  for (const ev of events) {
    if (ev.event !== 'tool' || !ev.tool_name) continue;
    let cls = classify(ev.tool_name);
    if (!cls) continue;
    let command = cls === 'execute' ? commandOf(ev.tool_input) : undefined;
    let target = cls === 'execute' ? undefined : targetOf(ev.tool_input, cwd);
    if (cls === 'execute' && command) {
      const sc = shellClass(command, cwd);
      if (sc) { cls = sc.cls; target = sc.target; command = undefined; }
    }
    const action = command ? `run: ${command}` : target ? `${cls} ${target}` : `${cls} (${ev.tool_name})`;
    const last = steps[steps.length - 1];
    if (last && last.action === action) { last.repeat = (last.repeat ?? 1) + 1; continue; }
    steps.push({ seq: steps.length + 1, cls, action, command, target });
  }
  return steps;
}
