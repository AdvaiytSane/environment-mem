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
import { stateDir } from './paths.ts';
import { backendFor, memorableConnection, pendingMemorable, syncMemorable } from './memorable.ts';
import { adapterCommand } from './sdk/adapters.ts';

const HELP = `headstart  the second session starts where the first one finished

  init                 write .headstart/config.json (backend: local | memorable)
  install [--all]      write hook files for Claude Code, Devin CLI, Codex found on this machine
  uninstall            remove headstart hooks from those files
  hook <Event>         stdin: one hook event (SessionStart | UserPromptSubmit | PostToolUse | Stop)
  recall "<task>"      print the best procedure for a task, --json for raw
  recall --procedure <slug>  read a Memorable procedure through the active connection
  connection           show selected backend and pending Memorable submissions
  sync                 retry pending Memorable submissions (same workflow IDs)
  memory <recall|store> --adapter <file>  JSON bridge to an optional SDK adapter
  facts                print what headstart knows about this repo
  doc [--write]        a repository doc generated from recorded sessions; --write puts it in AGENTS.md and CLAUDE.md
  list                 list stored procedures
  skills               write .agents/skills/*/SKILL.md and .claude/skills/*/SKILL.md
  eval [flags]         run the cold / doc / facts / full comparison on a fixture
  report <dir>         print the table for an eval directory, write console.html

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
    case 'memory': return adapterCommand(args);
    case 'hook': return runHook(args[0]);
    case 'init': {
      const dir = stateDir(cwd);
      const backend = flag(args, 'backend', process.env.HEADSTART_BACKEND ?? 'local');
      if (backend !== 'local' && backend !== 'memorable') throw new Error('backend must be local or memorable');
      const cfg = { backend, created_at: new Date().toISOString() };
      writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
      console.log(`wrote ${join(dir, 'config.json')} (backend ${backend})`);
      if (backend === 'memorable' && !process.env.MEMORABLE_API_KEY) console.log('set MEMORABLE_API_KEY, or run `memorable login`');
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
      const words = args.filter((a, i) => !a.startsWith('--') && !['--limit', '--procedure'].includes(args[i - 1]));
      const q = words.join(' ');
      if (backendFor(cwd) === 'memorable') {
        if (args.includes('--json')) throw new Error('The published Memorable CLI returns text; --json is unavailable for this connection.');
        const procedureId = flag(args, 'procedure');
        const result = await memorableConnection(cwd).recall(procedureId
          ? { procedureId } : { query: q, mode: args.includes('--chain') ? 'chain' : args.includes('--single') ? 'single' : 'auto' });
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        return;
      }
      if (args.includes('--procedure')) throw new Error('--procedure requires the memorable backend');
      const hits = recall(cwd, q, { k: Number(flag(args, 'limit', '3')), minScore: 0 });
      if (args.includes('--json')) return console.log(JSON.stringify(hits, null, 2));
      if (!hits.length) return console.log('no matching procedures');
      for (const h of hits) console.log(renderProcedure(h), '\n');
      return;
    }
    case 'connection': {
      return console.log(JSON.stringify({ backend: backendFor(cwd), transport: backendFor(cwd) === 'memorable' ? 'cli' : 'local',
        pendingSubmissions: pendingMemorable(cwd).length, durableRemoteStorage: 'unverified' }, null, 2));
    }
    case 'sync': {
      for (const result of await syncMemorable(cwd)) {
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
      }
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
    case 'report': {
      const dir = resolve(args[0] ?? '.');
      console.log(report(dir));
      console.log(`console: ${writeConsole(dir)}`);
      return;
    }
    default: return console.log(HELP);
  }
}

main(process.argv.slice(2)).catch(e => {
  if (process.argv[2] === 'memory') {
    process.stdout.write(JSON.stringify({ schema: 'memorable.adapter.v1', operation: process.argv[3],
      error: { code: typeof e?.code === 'string' && /^[a-z_]{1,80}$/.test(e.code) ? e.code : 'adapter_error',
        message: e instanceof Error ? e.message.slice(0, 4096) : 'adapter failed' } }) + '\n');
  } else console.error(e?.stack ?? String(e));
  process.exit(1);
});
