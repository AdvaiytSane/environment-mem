import { createServer, type ServerResponse } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildGraph, readStores } from './graph.ts';
import { summarize } from './report.ts';
import type { Run } from './eval.ts';
import { PAGE } from './live-page.ts';
import { HARNESS_NAME, harnessOf } from './harness.ts';
const UI_DIR = resolve(new URL('./ui/', import.meta.url).pathname);
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

// `headstart console --live`: one process, no dependencies. Serves the page,
// the graph and the eval summary, and streams every hook event written under
// the watched directories as it lands. The page does the drawing.

export interface LiveOpts { port: number; results?: string; stores: string[]; watch: string[]; mark?: string; /** A directory whose subdirectories are lanes, discovered as they appear. */ live?: string }

interface Client { res: ServerResponse }

function sse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function tailer(dir: string, onLine: (line: string, file: string) => void): () => void {
  const offsets = new Map<string, number>();
  const sessions = join(dir, '.headstart', 'sessions');
  const log = join(dir, '.headstart', 'headstart.log');
  const read = (file: string) => {
    if (!existsSync(file)) return;
    const size = statSync(file).size;
    let from = offsets.get(file) ?? 0;
    // A recreated (truncated) file starts over.
    if (size < from) from = 0;
    if (size <= from) return;
    const buf = Buffer.alloc(size - from);
    const fd = openSync(file, 'r');
    readSync(fd, buf, 0, size - from, from);
    closeSync(fd);
    offsets.set(file, size);
    for (const line of buf.toString('utf8').split('\n')) if (line.trim()) onLine(line, file);
  };
  const scan = () => {
    if (existsSync(sessions)) for (const f of readdirSync(sessions)) read(join(sessions, f));
    read(log);
  };
  const timer = setInterval(scan, 400);
  scan();
  return () => clearInterval(timer);
}

export function serveLive(o: LiveOpts): void {
  const clients = new Set<Client>();
  const stores = o.stores.map(s => resolve(s));
  let graph = buildGraph(readStores(stores));
  const summary = () => {
    if (!o.results) return null;
    const f = join(resolve(o.results), 'runs.jsonl');
    if (!existsSync(f)) return null;
    const runs = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Run);
    return {
      summary: summarize(runs), runner: runs[0]?.runner, model: runs[0]?.model, n: runs.length,
      runs: runs.filter(r => !r.error).map(r => ({ task: r.task, arm: r.arm, calls: r.tool_calls, discovery: r.discovery_calls, seconds: r.duration_s, cost: r.cost_usd, tokens: r.context_tokens })),
    };
  };
  const broadcast = (event: string, data: unknown) => { for (const c of clients) sse(c.res, event, data); };
  // Hand-off records: written by the sender at hand-off time, joined here with
  // what the receiver's own trace says (its prompt, its harness, its counts).
  const handoffs: any[] = [];
  const receivers = new Map<string, { prompt?: string; harness?: string; tools: string[]; calls: number; discovery: number; edited: boolean; lane: string; stopped: boolean }>();
  const receiver = (session: string, lane: string) => receivers.get(session) ?? receivers.set(session, { tools: [], calls: 0, discovery: 0, edited: false, lane, stopped: false }).get(session)!;
  const pairFigures = (session: string) => {
    // A cold run of the same task, in the other lane, gives the pair figure.
    const me = receivers.get(session); if (!me || !me.stopped) return null;
    const other = [...receivers.values()].filter(r => r.lane !== me.lane && r.stopped && r.prompt === me.prompt).pop();
    if (!other) return null;
    return { calls: me.calls - other.calls, discovery: me.discovery - other.discovery };
  };
  const handoffRows = () => handoffs.map(h => { const r = receivers.get(h.session); return { ...h, receiver: { harness: r?.harness ?? 'unknown', prompt: r?.prompt ?? h.prompt, calls: r?.calls, discovery: r?.discovery, done: r?.stopped ?? false }, pair: pairFigures(h.session) }; }).reverse();
  // The last session per lane, replayed to a page that connects after it ran.
  const replay = new Map<string, { event: string; data: any }[]>();
  const remember = (lane: string, event: string, data: any) => {
    if (event === 'trace' && data.event === 'start') replay.set(lane, []);
    const buf = replay.get(lane) ?? [];
    buf.push({ event, data });
    replay.set(lane, buf);
  };

  const lanes: string[] = [];
  const attach = (dir: string, label: string) => {
    if (lanes.includes(label)) return;
    lanes.push(label);
    broadcast('lane', { lane: label });
    tailer(resolve(dir), (line, file) => {
      if (file.endsWith('.log')) {
        if (line.includes('"handoff":1')) {
          try {
            const rec = JSON.parse(line.slice(line.indexOf('{')));
            rec.lane = label;
            handoffs.push(rec);
            const d = { lane: label, kind: 'prompt', session: rec.session, record: rec, ids: rec.from.map((f: any) => f.id), harnesses: Object.fromEntries(rec.from.reduce((m: Map<string, number>, f: any) => m.set(f.harness, (m.get(f.harness) ?? 0) + 1), new Map())), recorded: rec.from[0]?.created_at, matches: rec.n, score: rec.score, chars: 0 };
            remember(label, 'inject', d); broadcast('inject', d);
          } catch {}
          return;
        }
        const m = line.match(/inject (start|prompt) (\S+)(?: score=([\d.]+))? chars=(\d+)(?: from=(\S+))?(?: matches=(\d+))?(?: ids=(\S+))?(?: harnesses=(\S+))?(?: recorded=(\S+))?/);
        if (m) {
          // A prompt-level line is followed by its JSON record, which carries more; only the start line is sent from here.
          if (m[1] === 'prompt') return;
          const sessions = line.match(/sessions=(\d+)/);
          const d = { lane: label, kind: m[1], session: m[2], chars: Number(m[4]), sessions: sessions ? Number(sessions[1]) : undefined };
          remember(label, 'inject', d); broadcast('inject', d);
        }
        const s = line.match(/stored (\S+) steps=(\d+) discovery=(\d+) total=(\d+)/);
        if (s) { graph = buildGraph(readStores(stores)); broadcast('stored', { lane: label, id: s[1], steps: Number(s[2]), discovery: Number(s[3]), total: Number(s[4]) }); broadcast('graph', graph); }
        return;
      }
      try {
        const ev = JSON.parse(line);
        const input = ev.tool_input ?? {};
        const rc = receiver(ev.session_id, label);
        if (ev.event === 'prompt') rc.prompt = ev.prompt;
        if (ev.event === 'tool' && ev.tool_name) {
          rc.tools.push(ev.tool_name); rc.harness = harnessOf(rc.tools);
          const cls = /edit|write|patch|create/i.test(ev.tool_name) && !/read/i.test(ev.tool_name) ? 'write' : 'other';
          if (!/todo|skill|task|ask_user/i.test(ev.tool_name)) { rc.calls++; if (cls === 'write' && !rc.edited) { rc.edited = true; rc.discovery = rc.calls - 1; } if (!rc.edited) rc.discovery = rc.calls; }
        }
        if (ev.event === 'stop') rc.stopped = true;
        const rawTarget = String(input.file_path ?? input.path ?? input.pattern ?? input.command ?? '');
        const wd = resolve(dir) + '/';
        const d = {
          lane: label, session: ev.session_id, event: ev.event, tool: ev.tool_name, ts: ev.ts,
          // paths inside the lane's own copy of the repo read as the repo saw them
          target: rawTarget.split(wd).join(''), prompt: ev.prompt,
        };
        remember(label, 'trace', d);
        broadcast('trace', d);
      } catch {}
    });
  };
  o.watch.forEach((dir, i) => attach(dir, ['cold', 'headstart', 'c', 'd'][i] ?? `w${i}`));
  // The live root: every subdirectory with a .headstart inside is a lane, in
  // the order it appeared. A plan creates them as its waves start.
  const watchedStores = new Set<string>();
  if (o.live) {
    const root = resolve(o.live);
    const liveStore = join(root, 'store.jsonl');
    if (!stores.includes(liveStore)) stores.push(liveStore);
    const scan = () => {
      if (!existsSync(root)) return;
      const dirs = readdirSync(root).filter(d => existsSync(join(root, d, '.headstart'))).map(d => ({ d, t: statSync(join(root, d)).mtimeMs })).sort((a, b) => a.t - b.t).map(x => x.d);
      for (const d of dirs) attach(join(root, d), d);
      if (existsSync(liveStore) && !watchedStores.has(liveStore)) { watchedStores.add(liveStore); try { watch(liveStore, () => { graph = buildGraph(readStores(stores)); broadcast('graph', graph); }); } catch {} }
    };
    setInterval(scan, 1500); scan();
  }
  for (const s of stores) { if (!existsSync(s) || watchedStores.has(s)) continue; watchedStores.add(s); try { watch(s, () => { graph = buildGraph(readStores(stores)); broadcast('graph', graph); }); } catch {} }

  const markPath = o.mark && existsSync(o.mark) ? o.mark : undefined;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/' || url.pathname === '/ui' || url.pathname === '/ui/') {
      const idx = join(UI_DIR, 'index.html');
      if (existsSync(idx)) { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(readFileSync(idx)); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); return;
    }
    if (url.pathname === '/legacy') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); return; }
    if (url.pathname.startsWith('/ui/')) {
      const f = join(UI_DIR, url.pathname.slice(4).replace(/\.\./g, ''));
      if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(readFileSync(f)); return;
    }
    if (url.pathname === '/api/graph') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(graph)); return; }
    if (url.pathname === '/api/summary') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(summary())); return; }
    if (url.pathname === '/api/handoffs') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(handoffRows())); return; }
    if (url.pathname === '/mark.svg') {
      if (!markPath) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(readFileSync(markPath)); return;
    }
    if (url.pathname === '/api/live') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': ok\n\n');
      const c = { res };
      clients.add(c);
      sse(res, 'hello', { lanes, stores, results: o.results ?? null, harness: HARNESS_NAME });
      for (const [, buf] of replay) for (const { event, data } of buf) sse(res, event, data);
      req.on('close', () => clients.delete(c));
      return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(o.port, () => {
    console.log(`headstart console  http://localhost:${o.port}`);
    console.log(`  stores  ${stores.length} (${graph.nodes.filter(n => n.kind === 'session').length} sessions)`);
    console.log(`  watch   ${o.watch.length ? o.watch.join(', ') : 'none'}${o.live ? `, live root ${resolve(o.live)}` : ''}`);
    console.log(`  results ${o.results ?? 'none'}`);
  });
}
