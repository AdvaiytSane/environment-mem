import type { Procedure, Recalled } from './types.ts';
import { tokenize } from './extract.ts';
import { readAll } from './store.ts';
import { repoName } from './paths.ts';
import { ncd, queryText } from './ncd.ts';

export interface RecallOpts { k?: number; excludeTask?: string; minScore?: number }

export function recall(cwd: string, query: string, opts: RecallOpts = {}): Recalled[] {
  const repo = repoName(cwd);
  const all = readAll(cwd).filter(p => !opts.excludeTask || p.task_id !== opts.excludeTask);
  if (!all.length) return [];
  const q = new Set(tokenize(query));
  if (!q.size) return [];
  const df = new Map<string, number>();
  for (const p of all) for (const t of new Set(p.search_text.split(' '))) df.set(t, (df.get(t) ?? 0) + 1);
  const N = all.length;
  const lexical = all.map(p => {
    const terms = new Set(p.search_text.split(' '));
    const promptTerms = new Set(tokenize(p.prompt));
    let s = 0;
    // A term in the earlier prompt counts double: the words of the task are
    // a better signal of shape than the file names the task happened to touch.
    for (const t of q) if (terms.has(t)) s += Math.log(1 + N / (df.get(t) ?? 1)) * (promptTerms.has(t) ? 2 : 1);
    const norm = s / Math.sqrt(q.size);
    const promptHit = [...promptTerms].filter(t => q.has(t)).length / Math.max(1, q.size);
    return { procedure: p, score: norm * (p.repo === repo ? 1 : 0.5) + promptHit };
  });
  // Second signal: compression distance between the two prompts. Lexical
  // overlap is blind to word order and to shared phrasing it has no term
  // for; gzip is not. Leave-one-out on the fixture store: lexical alone
  // ranks a same-shape task first 7 of 9 times, the sum 8 of 9.
  const maxLex = Math.max(...lexical.map(r => r.score), 1e-9);
  const qt = queryText(query);
  const scored = lexical.map(r => ({
    procedure: r.procedure,
    score: r.score <= 0 ? 0 : r.score / maxLex + (1 - ncd(qt, queryText(r.procedure.prompt || r.procedure.title))),
  }));
  return scored.filter(r => r.score >= (opts.minScore ?? 0.35)).sort((a, b) => b.score - a.score).slice(0, opts.k ?? 3);
}

export interface RepoFacts { repo: string; sessions: number; verify: string[]; entry: string[]; hubs: string[] }

export function repoFacts(cwd: string, excludeTask?: string): RepoFacts | null {
  const repo = repoName(cwd);
  const mine = readAll(cwd).filter(p => p.repo === repo && (!excludeTask || p.task_id !== excludeTask));
  if (!mine.length) return null;
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  return {
    repo,
    sessions: mine.length,
    verify: count(mine.flatMap(p => p.postconditions)).slice(0, 1),
    entry: count(mine.flatMap(p => p.preconditions.filter(x => !x.startsWith('grep ')))).slice(0, 5),
    hubs: count(mine.flatMap(p => p.files_written)).filter(f => mine.filter(p => p.files_written.includes(f)).length > 1).slice(0, 4),
  };
}

export interface Counted { name: string; n: number }
export interface Similar {
  n: number;
  closest: Recalled;
  verify: Counted[];
  changed: Counted[];
  readFirst: Counted[];
  discovery: number;
  /** Which harness recorded each match, e.g. [{name:'claude',n:2},{name:'devin',n:1}]. */
  harnesses: Counted[];
  ids: string[];
}

function countBy(lists: string[][]): Counted[] {
  const m = new Map<string, number>();
  for (const xs of lists) for (const x of new Set(xs)) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/** The top matches folded into counts: which files changed in how many of
 * them, what verified them, what they read first. Counts are the claim. */
export function similar(cwd: string, query: string, opts: RecallOpts = {}): Similar | null {
  // One entry per task: repeated recordings of the same task would count
  // twice and make "3 of 3" a claim about one task.
  const raw = recall(cwd, query, { k: (opts.k ?? 3) * 3, excludeTask: opts.excludeTask, minScore: opts.minScore });
  const seen = new Set<string>();
  const hits = raw.filter(h => { const key = h.procedure.task_id ?? h.procedure.id; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, opts.k ?? 3);
  if (!hits.length) return null;
  const ps = hits.map(h => h.procedure);
  return {
    n: ps.length,
    closest: hits[0],
    verify: countBy(ps.map(p => p.postconditions)).slice(0, 2),
    changed: countBy(ps.map(p => p.files_written)).slice(0, 6),
    readFirst: countBy(ps.map(p => p.preconditions.filter(x => !x.startsWith('grep ')))).slice(0, 6),
    discovery: Math.round(ps.reduce((a, p) => a + p.discovery_calls, 0) / ps.length),
    harnesses: countBy(ps.map(p => [p.harness ?? 'unknown'])),
    ids: ps.map(p => p.id),
  };
}
