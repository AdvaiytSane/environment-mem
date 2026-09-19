import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Procedure } from './types.ts';
import { readAll } from './store.ts';
import { repoName } from './paths.ts';

export const SKILL_DIRS = ['.agents/skills', '.claude/skills'];

export function slugOf(p: Procedure): string {
  const s = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return s || `procedure-${p.id}`;
}

export function renderSkill(p: Procedure): string {
  const desc = `${p.title}. Learned from a ${p.repo} session with ${p.total_calls} tool calls.`.replace(/\n/g, ' ').slice(0, 200);
  const lines = [
    '---',
    `name: ${slugOf(p)}`,
    `description: ${desc}`,
    '---',
    '',
    `# ${p.title}`,
    '',
    'Written by headstart from a recorded session. Reference data, check it against the code before relying on it.',
    '',
  ];
  if (p.postconditions.length) lines.push('## Verify', '', ...p.postconditions.map(c => `- \`${c}\``), '');
  if (p.preconditions.length) lines.push('## Read first', '', ...p.preconditions.map(f => `- ${f}`), '');
  if (p.files_written.length) lines.push('## Files changed last time', '', ...p.files_written.map(f => `- ${f}`), '');
  lines.push('## Steps last time', '');
  for (const s of p.steps.filter(s => s.cls !== 'other')) lines.push(`${s.seq}. ${s.action}${s.repeat && s.repeat > 1 ? ` (x${s.repeat})` : ''}`);
  lines.push('');
  return lines.join('\n');
}

export function writeSkills(cwd: string, opts: { limit?: number; dirs?: string[] } = {}): string[] {
  const repo = repoName(cwd);
  const mine = readAll(cwd).filter(p => p.repo === repo && p.files_written.length);
  const seen = new Set<string>();
  const picked: Procedure[] = [];
  for (const p of mine.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const slug = slugOf(p);
    if (seen.has(slug)) continue;
    seen.add(slug);
    picked.push(p);
    if (picked.length >= (opts.limit ?? 20)) break;
  }
  const out: string[] = [];
  for (const dir of opts.dirs ?? SKILL_DIRS) {
    for (const p of picked) {
      const d = join(cwd, dir, slugOf(p));
      mkdirSync(d, { recursive: true });
      const f = join(d, 'SKILL.md');
      writeFileSync(f, renderSkill(p));
      out.push(f);
    }
  }
  return out;
}
