import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));

// Install the real package into independent consumers: importing from the
// checkout alone misses Node's prohibition on TypeScript in node_modules.
test('local checkout and packed npm artifact expose runnable SDK and CLI', { timeout: 60_000 }, t => {
  const temporary = mkdtempSync(join(tmpdir(), 'headstart-package-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}` };
  delete env.HEADSTART_BIN;
  const run = (command, args, cwd) => {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stderr}\n${result.error ?? ''}`);
    return result.stdout;
  };
  const npm = (args, cwd) => run(process.env.npm_execpath ? process.execPath : 'npm', [
    ...(process.env.npm_execpath ? [process.env.npm_execpath] : []), ...args,
    '--cache', join(temporary, 'npm-cache'), '--no-audit', '--no-fund',
  ], cwd);

  run(process.execPath, ['scripts/build.mjs'], root);
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root))[0];
  assert.ok(packed.files.some(file => file.path === 'dist/sdk/index.js'));
  assert.ok(packed.files.some(file => file.path === 'src/sdk/index.ts'));
  assert.equal(packed.files.some(file => /^(results|\.headstart|test)\//.test(file.path)), false);

  for (const [name, source] of [['checkout', root], ['tarball', join(temporary, packed.filename)]]) {
    const consumer = join(temporary, name);
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: `headstart-${name}-consumer`, private: true, type: 'module' }));
    // The packed artifact must work even when consumers disable lifecycle
    // scripts. Local-directory installation exercises the normal prepare hook.
    npm(['install', ...(name === 'tarball' ? ['--ignore-scripts'] : []), source], consumer);
    const observed = JSON.parse(run(process.execPath, ['--input-type=module', '-e', `
      import { createMemorable } from 'headstart/memorable';
      import { createMemorable as rootExport } from 'headstart';
      import { loadAdapter, invokeAdapter } from 'headstart/adapters';
      import { binCommand } from './node_modules/headstart/dist/install.js';
      const client = createMemorable();
      console.log(JSON.stringify({ store: typeof client.store, recall: typeof client.recall,
        sameExport: rootExport === createMemorable, adapterExports: [typeof loadAdapter, typeof invokeAdapter], hookCommand: binCommand() }));
    `], consumer));
    assert.equal(observed.store, 'function');
    assert.equal(observed.recall, 'function');
    assert.equal(observed.sameExport, true);
    assert.deepEqual(observed.adapterExports, ['function', 'function']);
    assert.ok(observed.hookCommand.includes(join('dist', 'cli.js')));
    const manifest = JSON.parse(readFileSync(join(consumer, 'node_modules', 'headstart', 'package.json'), 'utf8'));
    assert.equal(manifest.exports['./memorable'].types, './src/sdk/index.ts');
    const help = run(join(consumer, 'node_modules', '.bin', 'headstart'), ['--help'], consumer);
    assert.match(help, /headstart/);
  }
});
