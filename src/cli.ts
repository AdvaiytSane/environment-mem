import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runHook } from './hook.ts';
import { detect, install, uninstall } from './install.ts';
import { recall, repoFacts } from './recall.ts';
import { readAll } from './store.ts';
import { renderDoc, renderFacts, renderProcedure } from './inject.ts';
import { writeSkills } from './skills.ts';
import { ARMS, runEval, type Arm } from './eval.ts';
import { report } from './report.ts';
import { writeConsole } from './console.ts';
import { serveLive } from './live.ts';
import { buildGraph, readStores } from './graph.ts';
import { writeVault } from './obsidian.ts';
import { describe, loadTasks, orchestrate, runOne, type Plan, type RunSpec } from './run.ts';
import { stateDir } from './paths.ts';

const HELP = `headstart  the second session starts where the first one finished

  init                 write .headstart/config.json
  install [--all]      write hook files for Claude Code, Devin CLI, Codex found on this machine
  uninstall            remove headstart hooks from those files
  hook <Event>         stdin: one hook event (SessionStart | UserPromptSubmit | PostToolUse | Stop)
  recall "<task>"      print the best procedure for a task, --json for raw
  facts                print what headstart knows about this repo
  doc [--write]        a repository doc generated from recorded sessions; --write puts it in AGENTS.md and CLAUDE.md
  list                 list stored procedures
  skills               write .agents/skills/*/SKILL.md and .claude/skills/*/SKILL.md
  eval [flags]         run the cold / doc / facts / full comparison on a fixture
  report <dir>         print the table for an eval directory, write console.html
  obsidian --out <dir> write an Obsidian vault in graphify's shape: a note per session and file, _COMMUNITY_ and _SHAPE_ notes, a canvas
  console --live       serve the live page: one lane per run, sessions over time, the similarity graph, the table
                       [--live results/live] [--watch dir1,dir2] [--results <dir>] [--stores a,b] [--port 4177]
  run                  one real agent session in a fresh copy of a repo, hooks on, traced into a lane
                       --agent claude|devin --lane <name> --task <id or text> [--inject full|facts|0] [--record 0|1]
                       [--repo fixtures/repo] [--live results/live] [--store results/live/store.jsonl] [--model sonnet]
  orchestrate          waves of runs from a plan; a wave runs at once, the next wave recalls what it stored
                       [--plan fixtures/orchestrate-demo.json] [--agent claude|devin] [--live <dir>] [--repo <dir>] [--model <id>]

eval flags
  --tasks <file>       default fixtures/tasks.json
  --fixture <dir>      default fixtures/repo
  --static-doc <file>  default fixtures/static-doc/AGENTS.md
  --out <dir>          default results/<timestamp>
  --arms a,b,c         default cold,doc,autodoc,facts,full
  --repeats <n>        default 2
  --runner claude|devin  default claude
  --model <id>         default sonnet
  --parallel <n>       default 3
  --timeout <min>      default 12
  --only id1,id2       run a subset of tasks
`;

function flag(args: string[], name: string, dflt?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}

async function main(argv: string[]): Promise<void> {
  const [cmd, ...args] = argv;
  const cwd = process.cwd();
  switch (cmd) {
    case 'hook': return runHook(args[0]);
    case 'init': {
      const dir = stateDir(cwd);
      const backend = 'local';
      const cfg = { backend, created_at: new Date().toISOString() };
      writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
      console.log(`wrote ${join(dir, 'config.json')} (backend ${backend})`);
      console.log('next: headstart install');
      return;
    }
    case 'install': {
      const all = args.includes('--all');
      const written = install(cwd, all ? { targets: ['claude', 'devin', 'codex'] } : {});
      for (const t of detect(cwd)) console.log(`${t.present ? 'found  ' : 'absent '} ${t.name.padEnd(7)} ${written.includes(t.path) ? 'wrote ' + t.path : ''}`);
      console.log('Devin CLI reads the project .claude/settings.json, so that file covers it. --all also writes ~/.config/devin/config.json and ~/.codex/hooks.json.');
      return;
    }
    case 'uninstall': { for (const p of uninstall(cwd)) console.log(`cleaned ${p}`); return; }
    case 'recall': {
      const q = args.filter(a => !a.startsWith('--')).join(' ');
      const hits = recall(cwd, q, { k: Number(flag(args, 'limit', '3')), minScore: 0 });
      if (args.includes('--json')) return console.log(JSON.stringify(hits, null, 2));
      if (!hits.length) return console.log('no matching procedures');
      for (const h of hits) console.log(renderProcedure(h), '\n');
      return;
    }
    case 'doc': {
      const doc = renderDoc(cwd);
      if (!doc) return console.log('nothing stored for this repo yet');
      if (args.includes('--write')) {
        for (const f of ['AGENTS.md', 'CLAUDE.md']) { writeFileSync(join(cwd, f), doc); console.log(`wrote ${f}`); }
        return;
      }
      return console.log(doc);
    }
    case 'facts': {
      const f = repoFacts(cwd);
      return console.log(f ? renderFacts(f) : 'nothing stored for this repo yet');
    }
    case 'list': {
      for (const p of readAll(cwd)) console.log(`${p.id}  ${p.created_at.slice(0, 16)}  ${p.repo.padEnd(18)} calls=${String(p.total_calls).padStart(3)} disc=${String(p.discovery_calls).padStart(3)}  ${p.title}`);
      return;
    }
    case 'skills': {
      const files = writeSkills(cwd, { limit: Number(flag(args, 'limit', '20')) });
      for (const f of files) console.log(`wrote ${f}`);
      if (!files.length) console.log('nothing stored for this repo yet');
      return;
    }
    case 'eval': {
      const out = resolve(flag(args, 'out', join('results', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)))!);
      mkdirSync(out, { recursive: true });
      const arms = (flag(args, 'arms', ARMS.join(','))!.split(',') as Arm[]);
      const only = flag(args, 'only');
      const staticDoc = resolve(flag(args, 'static-doc', 'fixtures/static-doc/AGENTS.md')!);
      const opts = {
        tasks: resolve(flag(args, 'tasks', 'fixtures/tasks.json')!),
        fixture: resolve(flag(args, 'fixture', 'fixtures/repo')!),
        out, arms, repeats: Number(flag(args, 'repeats', '2')),
        runner: (flag(args, 'runner', 'claude') as 'claude' | 'devin'),
        model: flag(args, 'model', flag(args, 'runner', 'claude') === 'devin' ? '' : 'sonnet')!,
        parallel: Number(flag(args, 'parallel', '3')),
        staticDoc: existsSync(staticDoc) ? staticDoc : undefined,
        timeoutMs: Number(flag(args, 'timeout', '12')) * 60_000,
        only: only ? only.split(',') : undefined,
      };
      writeFileSync(join(out, 'opts.json'), JSON.stringify(opts, null, 2));
      const runs = await runEval(opts);
      console.log(report(out));
      console.log(`console: ${writeConsole(out)}`);
      console.log(`runs: ${runs}`);
      return;
    }
    case 'console': {
      // console --live [--port 4123] [--results <dir>] [--stores a.jsonl,b.jsonl] [--watch dir1,dir2] [--mark file.svg]
      const stores = (flag(args, 'stores') ?? [
        'results/claude-sonnet-r4-clean/store.jsonl', 'results/devin-sonnet-r1/store.jsonl',
        'results/claude-sonnet-r1/store.jsonl', 'results/claude-sonnet-r2/store.jsonl', 'results/devin-swe16-r1/store.jsonl',
      ].join(',')).split(',').map(s => resolve(s)).filter(existsSync);
      if (args.includes('--graph')) { console.log(JSON.stringify(buildGraph(readStores(stores)))); return; }
      const watchDirs = (flag(args, 'watch') ?? '').split(',').filter(Boolean);
      const mark = flag(args, 'mark', join(import.meta.dirname, 'ui', 'mark.svg'));
      serveLive({ port: Number(flag(args, 'port', '4177')), results: flag(args, 'results', 'results/claude-sonnet-r4-clean'), stores, watch: watchDirs, mark, live: flag(args, 'live', 'results/live') });
      return new Promise(() => {});
    }
    case 'run': {
      const agent = (flag(args, 'agent', 'claude') as RunSpec['agent']);
      const task = flag(args, 'task'); if (!task) { console.error('run needs --task <id or text>'); process.exit(2); }
      const live = resolve(flag(args, 'live', 'results/live')!);
      const store = resolve(flag(args, 'store', join(live, 'store.jsonl'))!);
      const spec: RunSpec = { lane: flag(args, 'lane', `${agent}-${Date.now().toString(36).slice(-4)}`)!, agent, task, inject: (flag(args, 'inject', 'full') as RunSpec['inject']), record: flag(args, 'record', '1') !== '0', model: flag(args, 'model', 'sonnet') };
      mkdirSync(live, { recursive: true });
      console.log(`${spec.lane}: ${agent} on "${task}"  inject=${spec.inject} record=${spec.record ? 1 : 0}
  traces  ${join(live, spec.lane, '.headstart')}
  store   ${store}`);
      const r = await runOne(spec, { live, store, repo: resolve(flag(args, 'repo', 'fixtures/repo')!), tasks: loadTasks(flag(args, 'tasks', 'fixtures/tasks.json')) });
      console.log(describe(r));
      return;
    }
    case 'orchestrate': {
      const plan = JSON.parse(readFileSync(resolve(flag(args, 'plan', 'fixtures/orchestrate-demo.json')!), 'utf8')) as Plan;
      for (const k of ['live', 'repo', 'model'] as const) { const v = flag(args, k); if (v) plan[k] = v; }
      const agent = flag(args, 'agent') as RunSpec['agent'] | undefined;
      if (agent) for (const w of plan.waves) for (const r of w) r.agent = agent;
      console.log(`plan: ${plan.waves.length} waves, ${plan.waves.flat().length} runs, store ${plan.store ?? join(plan.live ?? 'results/live', 'store.jsonl')}`);
      plan.waves.forEach((w, i) => console.log(`  wave ${i + 1}: ${w.map(r => `${r.lane} (${r.agent}, ${r.task}, inject=${r.inject ?? 'full'})`).join('; ')}`));
      const rs = await orchestrate(plan, { tasks: loadTasks(), onDone: r => console.log(describe(r)) });
      const handed = rs.filter(r => r.handed).length, cross = rs.filter(r => r.handed && r.handed.from.some(f => f.harness && f.harness !== r.agent)).length;
      console.log(`
${rs.length} runs, ${handed} handed a procedure, ${cross} across agents, ${rs.filter(r => r.stored).length} stored`);
      return;
    }
    case 'obsidian': {
      // obsidian --out <vault> [--stores a,b] [--results <dir>]: graphify-shaped vault
      const out = resolve(flag(args, 'out', 'results/vault')!);
      const stores = (flag(args, 'stores') ?? [
        'results/claude-sonnet-r4-clean/store.jsonl', 'results/devin-sonnet-r1/store.jsonl',
        'results/claude-sonnet-r1/store.jsonl', 'results/claude-sonnet-r2/store.jsonl', 'results/devin-swe16-r1/store.jsonl',
      ].join(',')).split(',').map(s => resolve(s)).filter(existsSync);
      const ps = readStores(stores);
      const g = buildGraph(ps);
      const rdir = resolve(flag(args, 'results', 'results/claude-sonnet-r4-clean')!);
      let summaryMd: string | undefined;
      if (existsSync(join(rdir, 'report.md'))) summaryMd = readFileSync(join(rdir, 'report.md'), 'utf8').split('\n## By shape')[0].split('\n').slice(2).join('\n');
      const r = writeVault(g, ps, out, { summaryMd });
      console.log(`vault ${out}: ${r.notes} notes, ${r.communities} communities, ${r.shapes} shapes, canvas, _INDEX.md${r.skipped.length ? `, skipped ${r.skipped.length} files you own` : ''}`);
      console.log('open it in Obsidian: File > Open vault > Open folder as vault');
      return;
    }
    case 'report': {
      const dir = resolve(args[0] ?? '.');
      console.log(report(dir));
      console.log(`console: ${writeConsole(dir)}`);
      return;
    }
    default: return console.log(HELP);
  }
}

main(process.argv.slice(2)).catch(e => { console.error(e?.stack ?? String(e)); process.exit(1); });
