import { existsSync, readFileSync } from 'node:fs';
import type { Procedure } from './types.ts';
import { dendrogram, distances, traceText } from './ncd.ts';

// The data behind the console page: every recorded session as a node, files
// as small nodes, compression-distance edges between sessions, two layers of
// clusters (sessions into procedures, procedures into shapes), and the
// timeline. Plain JSON, no layout: the page lays it out.

export interface GraphNode {
  id: string; kind: 'session' | 'file'; label: string; task?: string; harness?: string; repo: string;
  created_at?: string; calls?: number; discovery?: number; verified?: boolean; cluster?: number; shape?: number; files?: string[];
}
export interface GraphEdge { a: string; b: string; w: number; kind: 'similar' | 'wrote' | 'read' }
export interface Graph {
  nodes: GraphNode[]; edges: GraphEdge[];
  clusters: { id: number; members: string[]; centroid: string; shape: number; name: string }[];
  shapes: { id: number; clusters: number[]; label: string; name: string; centroid: string; size: number }[];
  timeline: { id: string; t: string; task?: string; harness?: string; calls: number; discovery: number; injected?: boolean }[];
  /** Pairwise compression distances between sessions, in `order`. */
  matrix: { order: string[]; d: number[][] };
  stats: { sessions: number; files: number; edges: number; clusters: number; shapes: number; modularity: number; mean_ncd_within: number; mean_ncd_between: number; harnesses: Record<string, number>; nn_task: number; nn_shape: number };
}

/** Newman modularity of a partition on a weighted undirected graph. */
function modularity(n: number, edges: { a: number; b: number; w: number }[], part: number[]): number {
  const k = new Array(n).fill(0);
  let m = 0;
  for (const e of edges) { k[e.a] += e.w; k[e.b] += e.w; m += e.w; }
  if (!m) return 0;
  let q = 0;
  for (const e of edges) if (part[e.a] === part[e.b]) q += e.w;
  const byPart = new Map<number, number>();
  for (let i = 0; i < n; i++) byPart.set(part[i], (byPart.get(part[i]) ?? 0) + k[i]);
  for (const kk of byPart.values()) q -= (kk * kk) / (4 * m);
  return q / m;
}

export function readStores(paths: string[]): Procedure[] {
  const byKey = new Map<string, Procedure>();
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const pr = JSON.parse(line) as Procedure;
        // Stores written before the harness field existed: the eval directory name says which runner made them.
        if (!pr.harness) pr.harness = /devin/i.test(p) ? 'devin' : /claude/i.test(p) ? 'claude' : 'unknown';
        byKey.set(`${p}:${pr.session_id}`, pr);
      } catch {}
    }
  }
  return [...byKey.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function buildGraph(ps: Procedure[], opts: { knn?: number; cut?: number; cut2?: number } = {}): Graph {
  const knn = opts.knn ?? 4;
  const texts = new Map(ps.map(p => [p.id, traceText(p)]));
  const D = distances(ps.map(p => texts.get(p.id)!));
  const nodes: GraphNode[] = ps.map(p => ({
    id: p.id, kind: 'session', label: p.title.slice(0, 70), task: p.task_id, harness: p.harness, repo: p.repo,
    created_at: p.created_at, calls: p.total_calls, discovery: p.discovery_calls, verified: p.postconditions.length > 0,
    files: p.files_written,
  }));
  // Each session keeps its k nearest neighbours as edges. A distance cut
  // would connect nearly everything in one repository; neighbours give a
  // layout that follows task shape (1-NN by NCD lands on the same shape for
  // 90 of 90 recorded sessions, the same task for 88).
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ps.length; i++) {
    const order = ps.map((_, j) => j).filter(j => j !== i).sort((a, b) => D[i][a] - D[i][b]).slice(0, knn);
    for (const j of order) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: ps[i].id, b: ps[j].id, w: 1 - D[i][j], kind: 'similar' });
    }
  }
  const files = new Map<string, GraphNode>();
  for (const p of ps) {
    for (const f of p.files_written) {
      const id = `file:${p.repo}:${f}`;
      if (!files.has(id)) files.set(id, { id, kind: 'file', label: f, repo: p.repo });
      edges.push({ a: p.id, b: id, w: 1, kind: 'wrote' });
    }
  }
  // One tree, two cuts: communities at the lower height, shapes at the higher.
  const tree = dendrogram(ps.map(p => ({ id: p.id, text: texts.get(p.id)! })), D);
  const layer1 = tree.cutAt(opts.cut ?? 0.5);
  const upper = tree.cutAt(opts.cut2 ?? 0.62);
  const layer2 = upper.map((u, id) => ({ id, centroid: u.centroid, members: layer1.filter(c => c.members.some(m => u.members.includes(m))).map(c => String(c.id)) }));
  const shapeOf = new Map<number, number>();
  for (const s of layer2) for (const m of s.members) shapeOf.set(Number(m), s.id);
  const clusterOf = new Map<string, number>();
  for (const c of layer1) for (const m of c.members) clusterOf.set(m, c.id);
  for (const n of nodes) { n.cluster = clusterOf.get(n.id); n.shape = n.cluster === undefined ? undefined : shapeOf.get(n.cluster); }
  const byId = new Map(ps.map(p => [p.id, p]));
  const majority = (ids: string[]) => {
    const t = new Map<string, number>();
    for (const id of ids) { const k = byId.get(id)?.task_id ?? 'session'; t.set(k, (t.get(k) ?? 0) + 1); }
    return [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'session';
  };
  // One name per group, used by the legend, the hull, the inspector and the matrix margin.
  const namedClusters = layer1.map(c => ({ ...c, shape: shapeOf.get(c.id) ?? -1, name: majority(c.members) }));
  const shapes = layer2.map(s => {
    const members = s.members.flatMap(m => layer1[Number(m)].members);
    const tasks = new Map<string, number>();
    for (const id of members) { const t = byId.get(id)?.task_id?.split('-')[0] ?? 'other'; tasks.set(t, (tasks.get(t) ?? 0) + 1); }
    const label = [...tasks.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
    const biggest = s.members.map(Number).map(c => layer1[c]).sort((a, b) => b.members.length - a.members.length)[0];
    return { id: s.id, clusters: s.members.map(Number), label, name: label, centroid: biggest?.centroid ?? s.centroid, size: members.length };
  });
  const timeline = ps.map(p => ({ id: p.id, t: p.created_at, task: p.task_id, harness: p.harness, calls: p.total_calls, discovery: p.discovery_calls }));
  // One order everywhere: shape by size (largest first), then cluster id, then recorded time.
  const shapeSize = new Map(shapes.map(s => [s.id, s.size]));
  const orderIdx = ps.map((_, i) => i).sort((a, b) => {
    const ca = clusterOf.get(ps[a].id) ?? -1, cb = clusterOf.get(ps[b].id) ?? -1;
    const sa = shapeSize.get(shapeOf.get(ca) ?? -1) ?? 0, sb = shapeSize.get(shapeOf.get(cb) ?? -1) ?? 0;
    return sb - sa || (shapeOf.get(ca) ?? 0) - (shapeOf.get(cb) ?? 0) || ca - cb || ps[a].created_at.localeCompare(ps[b].created_at);
  });
  const matrix = { order: orderIdx.map(i => ps[i].id), d: orderIdx.map(i => orderIdx.map(j => Number(D[i][j].toFixed(3)))) };
  const idx = new Map(ps.map((p, i) => [p.id, i]));
  const part = ps.map(p => clusterOf.get(p.id) ?? -1);
  const simEdges = edges.filter(e => e.kind === 'similar').map(e => ({ a: idx.get(e.a)!, b: idx.get(e.b)!, w: e.w }));
  let win = 0, wn = 0, btw = 0, bn = 0;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { if (part[i] === part[j]) { win += D[i][j]; wn++; } else { btw += D[i][j]; bn++; } }
  const harnesses: Record<string, number> = {};
  for (const p of ps) harnesses[p.harness ?? 'unknown'] = (harnesses[p.harness ?? 'unknown'] ?? 0) + 1;
  let nnTask = 0, nnShape = 0;
  for (let i = 0; i < ps.length; i++) {
    let best = -1, bd = Infinity;
    for (let j = 0; j < ps.length; j++) if (j !== i && D[i][j] < bd) { bd = D[i][j]; best = j; }
    if (best >= 0) { if (ps[best].task_id === ps[i].task_id) nnTask++; if (shapeOf.get(part[best]) === shapeOf.get(part[i])) nnShape++; }
  }
  const stats = {
    sessions: ps.length, files: files.size, edges: simEdges.length, clusters: layer1.length, shapes: layer2.length,
    modularity: Number(modularity(ps.length, simEdges, part).toFixed(3)),
    mean_ncd_within: Number((wn ? win / wn : 0).toFixed(3)), mean_ncd_between: Number((bn ? btw / bn : 0).toFixed(3)),
    harnesses, nn_task: nnTask, nn_shape: nnShape,
  };
  return { nodes: [...nodes, ...files.values()], edges, clusters: namedClusters, shapes, timeline, matrix, stats };
}
