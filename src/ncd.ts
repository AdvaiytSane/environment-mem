import { gzipSync } from 'node:zlib';
import type { Procedure } from './types.ts';

// Normalized compression distance. Two traces that share structure compress
// better together than apart. No model, no embedding, deterministic:
//   ncd(a, b) = (C(ab) - min(C(a), C(b))) / max(C(a), C(b))
// 0 is identical, about 1 is unrelated. gzip level 9, sizes in bytes.

const csize = new Map<string, number>();
export function csz(s: string): number {
  let n = csize.get(s);
  if (n === undefined) { n = gzipSync(Buffer.from(s), { level: 9 }).length; csize.set(s, n); }
  return n;
}

export function ncd(a: string, b: string): number {
  const ca = csz(a), cb = csz(b), cab = csz(a + '\n' + b);
  return (cab - Math.min(ca, cb)) / Math.max(ca, cb);
}

/** The text a procedure is compressed as: the prompt, then one line per
 * step in order (class, path or command with digits and quoted strings
 * stripped), then the files it changed. Order is the structure NCD sees. */
export function traceText(p: Procedure): string {
  const norm = (s: string) => s.toLowerCase().replace(/"[^"]*"|'[^']*'/g, '""').replace(/\d+/g, '0').replace(/\s+/g, ' ').trim();
  const lines = [norm(p.prompt || p.title)];
  for (const s of p.steps) lines.push(`${s.cls} ${norm(s.command ?? s.target ?? '')}`);
  lines.push(`changed ${p.files_written.map(norm).join(' ')}`);
  return lines.join('\n');
}

/** Query text in the same shape as a stored procedure's, with no steps yet. */
export function queryText(prompt: string): string {
  return prompt.toLowerCase().replace(/"[^"]*"|'[^']*'/g, '""').replace(/\d+/g, '0').replace(/\s+/g, ' ').trim();
}

export interface Cluster { id: number; members: string[]; centroid: string }

/**
 * Average-linkage agglomerative clustering on NCD. Every item starts alone;
 * the two clusters with the smallest mean pairwise distance merge while that
 * mean is under `cut`. Single linkage chains everything in a repository
 * together (same-shape and unrelated sessions overlap at the tails); the
 * mean does not. Quadratic in n with a cached distance matrix, fine for
 * hundreds of sessions.
 */
export function cluster(items: { id: string; text: string }[], cut = 0.5): Cluster[] {
  const n = items.length;
  const D: number[][] = items.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = ncd(items[i].text, items[j].text);
  let groups: number[][] = items.map((_, i) => [i]);
  const mean = (A: number[], B: number[]) => { let s = 0; for (const a of A) for (const b of B) s += D[a][b]; return s / (A.length * B.length); };
  while (groups.length > 1) {
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const d = mean(groups[i], groups[j]);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    if (bd >= cut) break;
    groups[bi] = groups[bi].concat(groups[bj]);
    groups.splice(bj, 1);
  }
  return groups.map((g, id) => {
    let best = g[0], bestSum = Infinity;
    for (const a of g) { const sum = g.reduce((acc, b) => acc + D[a][b], 0); if (sum < bestSum) { bestSum = sum; best = a; } }
    return { id, members: g.map(i => items[i].id), centroid: items[best].id };
  });
}

/** Distance matrix for reuse by the graph builder. */
export function distances(texts: string[]): number[][] {
  const n = texts.length;
  const D: number[][] = texts.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = ncd(texts[i], texts[j]);
  return D;
}

/**
 * One average-linkage dendrogram over all items, cut at two heights. Both
 * layers come from the same tree, so a shape is exactly the set of
 * communities that merge next. `cutAt(h)` returns the partition where every
 * merge below h has happened.
 */
export function dendrogram(items: { id: string; text: string }[], D?: number[][]) {
  const n = items.length;
  const M = D ?? distances(items.map(i => i.text));
  let groups: number[][] = items.map((_, i) => [i]);
  const merges: { a: number[]; b: number[]; h: number }[] = [];
  const mean = (A: number[], B: number[]) => { let s = 0; for (const a of A) for (const b of B) s += M[a][b]; return s / (A.length * B.length); };
  while (groups.length > 1) {
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) { const d = mean(groups[i], groups[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
    merges.push({ a: groups[bi], b: groups[bj], h: bd });
    groups[bi] = groups[bi].concat(groups[bj]);
    groups.splice(bj, 1);
  }
  const cutAt = (h: number): Cluster[] => {
    let gs: number[][] = items.map((_, i) => [i]);
    for (const m of merges) {
      if (m.h >= h) break;
      const ia = gs.findIndex(g => g.includes(m.a[0])), ib = gs.findIndex(g => g.includes(m.b[0]));
      if (ia < 0 || ib < 0 || ia === ib) continue;
      gs[ia] = gs[ia].concat(gs[ib]); gs.splice(ib, 1);
    }
    return gs.map((g, id) => {
      let best = g[0], bestSum = Infinity;
      for (const a of g) { const sum = g.reduce((acc, b) => acc + M[a][b], 0); if (sum < bestSum) { bestSum = sum; best = a; } }
      return { id, members: g.map(i => items[i].id), centroid: items[best].id };
    });
  };
  return { merges, cutAt };
}
