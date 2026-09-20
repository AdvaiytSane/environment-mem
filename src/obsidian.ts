import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Procedure } from './types.ts';
import type { Graph, GraphNode } from './graph.ts';
import { ncd, traceText } from './ncd.ts';

// Obsidian vault export in graphify's shape (github.com/safishamsi/graphify,
// export.to_obsidian and to_canvas): one note per node with YAML frontmatter,
// a Connections list of [[wikilinks]] carrying the relation and a confidence
// label, inline tags, one _COMMUNITY_ note per cluster with cohesion and
// cross-community links, a .canvas with clusters as groups, and a manifest so
// a re-export never touches a note it did not write. Two layers here where
// graphify has one: _COMMUNITY_ notes are compression-distance clusters of
// sessions, _SHAPE_ notes group those clusters. Colours for Obsidian's own
// graph view come from .obsidian/graph.json, keyed on the shape tag.

const MANIFEST = '.headstart_obsidian_manifest.json';
const COMMUNITY = '_COMMUNITY_';
const SHAPE = '_SHAPE_';

function yaml(s: unknown): string { return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' '); }
function stem(label: string, limit = 80): string {
  const s = label.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit).trim();
  return s || 'untitled';
}
function tag(s: string): string { return s.toLowerCase().replace(/[^a-z0-9_/-]+/g, '-').replace(/^-|-$/g, ''); }

export interface VaultResult { written: string[]; skipped: string[]; notes: number; communities: number; shapes: number }

export function writeVault(graph: Graph, procedures: Procedure[], outDir: string, opts: { summaryMd?: string } = {}): VaultResult {
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, MANIFEST);
  let owned = new Set<string>();
  try { owned = new Set((JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: string[] }).files); } catch {}
  const written: string[] = [];
  const skipped: string[] = [];
  const write = (rel: string, body: string): boolean => {
    const target = join(outDir, rel);
    if (existsSync(target) && !owned.has(rel)) { skipped.push(rel); return false; }
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, body);
    written.push(rel);
    return true;
  };

  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const proc = new Map(procedures.map(p => [p.id, p]));
  const clusterOf = new Map<string, number>();
  for (const c of graph.clusters) for (const m of c.members) clusterOf.set(m, c.id);
  const shapeOfCluster = new Map<number, number>();
  for (const s of graph.shapes) for (const c of s.clusters) shapeOfCluster.set(c, s.id);

  // Stable, unique filenames per node so every wikilink resolves.
  const used = new Set<string>();
  const fname = new Map<string, string>();
  const claim = (id: string, base: string) => {
    let cand = base, n = 1;
    while (used.has(cand.toLowerCase())) cand = `${base} ${++n}`;
    used.add(cand.toLowerCase());
    fname.set(id, cand);
  };
  const shapeLabel = (sid: number) => { const s = graph.shapes.find(x => x.id === sid); return s ? `shape ${sid} (${s.label})` : `shape ${sid}`; };
  const clusterLabel = (cid: number) => {
    const c = graph.clusters.find(x => x.id === cid);
    if (!c) return `community ${cid}`;
    const tasks = new Map<string, number>();
    for (const m of c.members) { const t = byId.get(m)?.task ?? 'session'; tasks.set(t, (tasks.get(t) ?? 0) + 1); }
    const top = [...tasks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${t} x${n}`).join(', ');
    return `${top}`;
  };
  for (const c of graph.clusters) claim(`cluster:${c.id}`, `${COMMUNITY}${stem(clusterLabel(c.id))}`);
  for (const s of graph.shapes) claim(`shape:${s.id}`, `${SHAPE}${stem(shapeLabel(s.id))}`);
  for (const n of graph.nodes) claim(n.id, n.kind === 'file' ? stem(n.label) : stem(`${n.task ?? 'session'} ${n.harness ?? ''} ${(n.created_at ?? '').slice(0, 16).replace('T', ' ')}`));

  const neighbours = new Map<string, { id: string; relation: string; w: number }[]>();
  for (const e of graph.edges) {
    (neighbours.get(e.a) ?? neighbours.set(e.a, []).get(e.a)!).push({ id: e.b, relation: e.kind, w: e.w });
    (neighbours.get(e.b) ?? neighbours.set(e.b, []).get(e.b)!).push({ id: e.a, relation: e.kind === 'wrote' ? 'changed by' : e.kind, w: e.w });
  }
  // graphify's labels: an edge stated by the source is EXTRACTED, a deduction
  // is INFERRED. A file a session wrote is stated in its trace; similarity is
  // a deduction from compression distance, so it carries the score.
  const confidence = (relation: string, w: number) => relation === 'similar' ? (w >= 0.5 ? 'INFERRED' : 'AMBIGUOUS') : 'EXTRACTED';

  let notes = 0;
  for (const n of graph.nodes) {
    const cid = clusterOf.get(n.id);
    const sid = cid === undefined ? undefined : shapeOfCluster.get(cid);
    const tags = [`headstart/${n.kind}`];
    if (n.harness) tags.push(`harness/${tag(n.harness)}`);
    if (cid !== undefined) tags.push(`community/${tag(clusterLabel(cid))}`);
    if (sid !== undefined) tags.push(`shape/${sid}`);
    if (n.verified) tags.push('headstart/verified');
    const L: string[] = ['---', `type: "${n.kind}"`, `repo: "${yaml(n.repo)}"`];
    if (n.task) L.push(`task: "${yaml(n.task)}"`);
    if (n.harness) L.push(`harness: "${yaml(n.harness)}"`);
    if (n.created_at) L.push(`recorded: "${yaml(n.created_at)}"`);
    if (n.calls !== undefined) L.push(`tool_calls: ${n.calls}`, `calls_before_first_edit: ${n.discovery ?? 0}`, `verified: ${n.verified ? 'true' : 'false'}`);
    if (cid !== undefined) L.push(`community: "${yaml(clusterLabel(cid))}"`);
    if (sid !== undefined) L.push(`shape: "${yaml(shapeLabel(sid))}"`);
    L.push('tags:', ...tags.map(t => `  - ${t}`), '---', '', `# ${n.label}`, '');
    const p = n.kind === 'session' ? proc.get(n.id) : undefined;
    if (p) {
      L.push(`Recorded ${p.harness ?? ''} session on ${p.repo}, ${p.total_calls} tool calls, ${p.discovery_calls} before the first edit.`, '');
      if (p.postconditions.length) L.push('## Verified with', '', ...p.postconditions.map(c => `- \`${c}\``), '');
      if (p.files_written.length) L.push('## Files changed', '', ...p.files_written.map(f => `- [[${fname.get(`file:${p.repo}:${f}`) ?? stem(f)}]]`), '');
      if (p.preconditions.length) L.push('## Read before changing', '', ...p.preconditions.slice(0, 8).map(f => `- ${f}`), '');
      const steps = p.steps.filter(s => s.cls !== 'other');
      // A command that happens to contain [[ would read as a wikilink.
      if (steps.length) L.push('## Steps', '', ...steps.map(s => `${s.seq}. ${s.action.split('\n')[0].slice(0, 140).replace(/\[\[/g, '[ [')}${s.repeat && s.repeat > 1 ? ` (x${s.repeat})` : ''}`), '');
    }
    const ns = (neighbours.get(n.id) ?? []).slice().sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
    if (ns.length) {
      L.push('## Connections', '');
      for (const x of ns) {
        const other = byId.get(x.id);
        if (!other) continue;
        const extra = x.relation === 'similar' ? ` ${x.w.toFixed(2)}` : '';
        L.push(`- [[${fname.get(x.id)}]] - \`${x.relation}${extra}\` [${confidence(x.relation, x.w)}]`);
      }
      L.push('');
    }
    if (cid !== undefined) L.push(`Community: [[${fname.get(`cluster:${cid}`)}]]${sid !== undefined ? `, shape: [[${fname.get(`shape:${sid}`)}]]` : ''}`, '');
    L.push(tags.map(t => `#${t}`).join(' '), '');
    if (write(`${fname.get(n.id)}.md`, L.join('\n'))) notes++;
  }

  // Cohesion: 1 minus the mean pairwise compression distance inside the
  // cluster, the same number the clustering cut on.
  const texts = new Map(procedures.map(p => [p.id, traceText(p)]));
  const cohesionOf = (members: string[]) => {
    const ms = members.filter(m => texts.has(m));
    if (ms.length < 2) return 1;
    let s = 0, k = 0;
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { s += ncd(texts.get(ms[i])!, texts.get(ms[j])!); k++; }
    return 1 - s / k;
  };
  const inter = new Map<number, Map<number, number>>();
  for (const e of graph.edges) {
    if (e.kind !== 'similar') continue;
    const a = clusterOf.get(e.a), b = clusterOf.get(e.b);
    if (a === undefined || b === undefined || a === b) continue;
    (inter.get(a) ?? inter.set(a, new Map()).get(a)!).set(b, (inter.get(a)!.get(b) ?? 0) + 1);
    (inter.get(b) ?? inter.set(b, new Map()).get(b)!).set(a, (inter.get(b)!.get(a) ?? 0) + 1);
  }
  let communities = 0;
  for (const c of graph.clusters) {
    const members = c.members.filter(m => byId.has(m));
    const coh = cohesionOf(members);
    const sid = shapeOfCluster.get(c.id);
    const L = ['---', 'type: community', `cohesion: ${coh.toFixed(2)}`, `members: ${members.length}`, `shape: "${yaml(sid === undefined ? '' : shapeLabel(sid))}"`, 'tags:', `  - community/${tag(clusterLabel(c.id))}`, ...(sid === undefined ? [] : [`  - shape/${sid}`]), '---', '',
      `# ${clusterLabel(c.id)}`, '', `${members.length} sessions whose traces compress together. Cohesion ${coh.toFixed(2)} (1 minus the mean pairwise gzip distance). Centre: [[${fname.get(c.centroid)}]].`, '', '## Members', ''];
    for (const m of members.slice().sort((a, b) => (byId.get(b)?.calls ?? 0) - (byId.get(a)?.calls ?? 0))) {
      const n = byId.get(m)!;
      L.push(`- [[${fname.get(m)}]] - ${n.calls} tool calls, ${n.discovery} before the first edit${n.verified ? ', verified' : ''}`);
    }
    const files = new Map<string, number>();
    for (const m of members) for (const f of byId.get(m)?.files ?? []) files.set(f, (files.get(f) ?? 0) + 1);
    const top = [...files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (top.length) L.push('', '## Files these sessions changed', '', ...top.map(([f, k]) => `- [[${fname.get(`file:${byId.get(members[0])?.repo}:${f}`) ?? stem(f)}]] - ${k} of ${members.length}`));
    const links = [...(inter.get(c.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
    if (links.length) L.push('', '## Connections to other communities', '', ...links.map(([o, k]) => `- [[${fname.get(`cluster:${o}`)}]] - ${k} similar-session edge${k === 1 ? '' : 's'}`));
    if (sid !== undefined) L.push('', `Shape: [[${fname.get(`shape:${sid}`)}]]`);
    L.push('', `#community/${tag(clusterLabel(c.id))}${sid === undefined ? '' : ` #shape/${sid}`}`, '');
    if (write(`${fname.get(`cluster:${c.id}`)}.md`, L.join('\n'))) communities++;
  }
  let shapes = 0;
  for (const s of graph.shapes) {
    const members = s.clusters.flatMap(c => graph.clusters.find(x => x.id === c)?.members ?? []);
    const L = ['---', 'type: shape', `communities: ${s.clusters.length}`, `sessions: ${members.length}`, 'tags:', `  - shape/${s.id}`, '---', '',
      `# ${shapeLabel(s.id)}`, '', `${s.clusters.length} communities, ${members.length} sessions. The second layer: communities whose centres compress together.`, '', '## Communities', '',
      ...s.clusters.map(c => `- [[${fname.get(`cluster:${c}`)}]] - ${graph.clusters.find(x => x.id === c)?.members.length ?? 0} sessions`), '', `#shape/${s.id}`, ''];
    if (write(`${fname.get(`shape:${s.id}`)}.md`, L.join('\n'))) shapes++;
  }

  // Index note: what the vault is, the measured table, entry points.
  const idx = ['---', 'type: index', '---', '', '# headstart', '',
    `${graph.nodes.filter(n => n.kind === 'session').length} recorded coding-agent sessions, ${graph.nodes.filter(n => n.kind === 'file').length} files, ${graph.clusters.length} communities in ${graph.shapes.length} shapes. Edges are gzip compression similarity between traces; communities are average-linkage clusters on the same distance. Open the graph view and colour by shape.`, '',
    '## Shapes', '', ...graph.shapes.map(s => `- [[${fname.get(`shape:${s.id}`)}]]`), '',
    '## Communities', '', ...graph.clusters.map(c => `- [[${fname.get(`cluster:${c.id}`)}]] - ${c.members.length} sessions`), ''];
  if (opts.summaryMd) idx.push('## Measured', '', opts.summaryMd, '');
  write('_INDEX.md', idx.join('\n'));

  // Canvas: one group per community, cards per session, similarity edges.
  const cards: any[] = [], cedges: any[] = [];
  const COLORS = ['1', '2', '3', '4', '5', '6'];
  const cols = Math.max(1, Math.ceil(Math.sqrt(graph.clusters.length)));
  const CW = 340, CH = 60, GAP = 40, INNER = 3;
  graph.clusters.forEach((c, i) => {
    const members = c.members.filter(m => byId.has(m));
    const rows = Math.ceil(members.length / INNER);
    const gx = (i % cols) * (INNER * (CW + GAP) + 120), gy = Math.floor(i / cols) * 900;
    const gw = INNER * (CW + GAP) + 40, gh = rows * (CH + GAP) + 80;
    const sid = shapeOfCluster.get(c.id) ?? 0;
    cards.push({ id: `group-${c.id}`, type: 'group', x: gx, y: gy, width: gw, height: gh, label: clusterLabel(c.id), color: COLORS[sid % COLORS.length] });
    members.forEach((m, k) => {
      cards.push({ id: `n-${m}`, type: 'file', file: `${fname.get(m)}.md`, x: gx + 20 + (k % INNER) * (CW + GAP), y: gy + 60 + Math.floor(k / INNER) * (CH + GAP), width: CW, height: CH });
    });
  });
  const inCanvas = new Set(cards.map(c => c.id));
  for (const e of graph.edges) {
    if (e.kind !== 'similar' || e.w < 0.55) continue;
    if (!inCanvas.has(`n-${e.a}`) || !inCanvas.has(`n-${e.b}`)) continue;
    cedges.push({ id: `e-${e.a}-${e.b}`, fromNode: `n-${e.a}`, toNode: `n-${e.b}`, fromSide: 'right', toSide: 'left', label: e.w.toFixed(2) });
  }
  write('headstart.canvas', JSON.stringify({ nodes: cards, edges: cedges }, null, 2));

  // Obsidian graph-view colours by shape tag; the live session in accent.
  const palette = ['#38bdf8', '#3ddc97', '#b7a6ff', '#e07a4a', '#f0616d', '#a1a1a1'];
  const groups = graph.shapes.map((s, i) => ({ query: `tag:#shape/${s.id}`, color: { a: 1, rgb: parseInt(palette[i % palette.length].slice(1), 16) } }));
  groups.push({ query: 'tag:#headstart/file', color: { a: 1, rgb: 0x5a5a5a } });
  mkdirSync(join(outDir, '.obsidian'), { recursive: true });
  const gcfg = join(outDir, '.obsidian', 'graph.json');
  if (!existsSync(gcfg) || owned.has('.obsidian/graph.json')) {
    writeFileSync(gcfg, JSON.stringify({ 'collapse-filter': true, search: '', showTags: false, showAttachments: false, hideUnresolved: true, showOrphans: true, 'collapse-color': false, colorGroups: groups, 'collapse-display': true, showArrow: false, textFadeThreshold: 0, nodeSizeMultiplier: 1.1, lineSizeMultiplier: 0.8, 'collapse-forces': true, centerStrength: 0.45, repelStrength: 12, linkStrength: 1, linkDistance: 200, scale: 1, close: false }, null, 2));
    written.push('.obsidian/graph.json');
  }
  writeFileSync(manifestPath, JSON.stringify({ files: [...new Set([...owned, ...written])], written_at: new Date().toISOString() }, null, 2));
  return { written, skipped, notes, communities, shapes };
}
