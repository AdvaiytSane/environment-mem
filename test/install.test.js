import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { binCommand, install, uninstall } from '../src/install.ts';

// Configuration safety checks only. These do not establish that a native
// harness supports, approves, or actually invokes any configured event.
function fixture(t, override = undefined) {
  const cwd = mkdtempSync(join(tmpdir(), 'headstart-install-'));
  const keys = ['HEADSTART_BIN', 'CODEX_HOME', 'XDG_CONFIG_HOME'];
  const before = keys.map(key => process.env[key]);
  process.env.CODEX_HOME = join(cwd, 'codex-config');
  process.env.XDG_CONFIG_HOME = join(cwd, 'user-config');
  if (override === undefined) delete process.env.HEADSTART_BIN;
  else process.env.HEADSTART_BIN = override;
  t.after(() => {
    keys.forEach((key, i) => before[i] === undefined ? delete process.env[key] : process.env[key] = before[i]);
    rmSync(cwd, { recursive: true, force: true });
  });
  const paths = {
    claude: join(cwd, '.claude', 'settings.json'),
    devin: join(process.env.XDG_CONFIG_HOME, 'devin', 'config.json'),
    codex: join(process.env.CODEX_HOME, 'hooks.json'),
  };
  const write = (name, value) => {
    mkdirSync(dirname(paths[name]), { recursive: true });
    writeFileSync(paths[name], typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  };
  const read = name => JSON.parse(readFileSync(paths[name], 'utf8'));
  return { cwd, paths, write, read };
}

test('install and uninstall retain other hooks in a shared group and unrelated settings', t => {
  const bin = "'/custom tools/headstart'";
  const f = fixture(t, bin);
  const other = { type: 'command', command: 'notify-team', timeout: 12 };
  const similar = { type: 'command', command: `${bin} hooked Stop` };
  const retained = { matcher: 'Bash', timeout: 60, hooks: [other, similar] };
  const original = { permissions: { allow: ['Read'] }, hooks: {
    Stop: [{ ...retained, hooks: [other, { type: 'command', command: `${bin} hook Stop` }, similar] }],
    Notification: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'Leave this alone' }] }],
  } };
  f.write('claude', original);
  install(f.cwd);
  const installed = f.read('claude');
  assert.deepEqual(installed.permissions, original.permissions);
  assert.deepEqual(installed.hooks.Stop[0], retained);
  assert.deepEqual(installed.hooks.Notification, original.hooks.Notification);
  assert.equal(installed.hooks.Stop[1].hooks[0].command, `${bin} hook Stop`);
  assert.deepEqual(uninstall(f.cwd), [f.paths.claude]);
  const removed = f.read('claude');
  assert.deepEqual(removed.hooks.Stop, [retained]);
  assert.deepEqual(removed.hooks.Notification, original.hooks.Notification);
  assert.deepEqual(removed.permissions, original.permissions);
  const unchanged = readFileSync(f.paths.claude, 'utf8');
  assert.deepEqual(uninstall(f.cwd), []);
  assert.equal(readFileSync(f.paths.claude, 'utf8'), unchanged);
});

test('reinstall replaces legacy and duplicate own hooks with one command per event', t => {
  const f = fixture(t);
  f.write('claude', { hooks: { Stop: [
    { hooks: [{ type: 'command', command: 'headstart hook Stop' }] },
    { matcher: '*', hooks: [{ type: 'command', command: `${binCommand()} hook Stop` }] },
  ] } });
  install(f.cwd);
  const first = readFileSync(f.paths.claude, 'utf8');
  install(f.cwd);
  assert.equal(readFileSync(f.paths.claude, 'utf8'), first);
  for (const groups of Object.values(f.read('claude').hooks)) {
    assert.equal(groups.length, 1);
    assert.equal(groups[0].hooks.length, 1);
  }
});

test('malformed JSON in any selected file aborts before changing other targets', t => {
  const f = fixture(t);
  f.write('claude', { permissions: { deny: ['Bash(rm:*)'] }, hooks: {} });
  f.write('codex', '{ "hooks": ');
  const before = readFileSync(f.paths.claude, 'utf8');
  assert.throws(() => install(f.cwd, { targets: ['claude', 'devin', 'codex'] }), /invalid JSON/);
  assert.equal(readFileSync(f.paths.claude, 'utf8'), before);
  assert.equal(readFileSync(f.paths.codex, 'utf8'), '{ "hooks": ');
  assert.equal(existsSync(f.paths.devin), false);
  assert.throws(() => uninstall(f.cwd), /invalid JSON/);
  assert.equal(readFileSync(f.paths.claude, 'utf8'), before);
});

test('registers the documented failure event only for the Claude settings target', t => {
  const f = fixture(t);
  install(f.cwd, { targets: ['claude', 'devin', 'codex'] });
  assert.equal(f.read('claude').hooks.PostToolUseFailure[0].hooks[0].command, `${binCommand()} hook PostToolUseFailure`);
  assert.equal(f.read('devin').hooks.PostToolUseFailure, undefined);
  assert.equal(f.read('codex').hooks.PostToolUseFailure, undefined);
});

test('invalid settings shapes are refused without replacing the original file', t => {
  const f = fixture(t);
  for (const value of ['null', '[]', '{"hooks":null}', '{"hooks":{"Stop":{}}}', '{"hooks":{"Stop":[{"hooks":[null]}]}}']) {
    f.write('claude', value);
    assert.throws(() => install(f.cwd), /invalid hooks structure/);
    assert.equal(readFileSync(f.paths.claude, 'utf8'), value);
  }
});

test('default command uses the current absolute Node runtime and safely quoted checkout path', async t => {
  const f = fixture(t);
  const copied = join(f.cwd, "checkout with spaces and 'quotes'", 'src');
  mkdirSync(copied, { recursive: true });
  copyFileSync(fileURLToPath(new URL('../src/install.ts', import.meta.url)), join(copied, 'install.ts'));
  writeFileSync(join(copied, 'cli.ts'), 'process.stdout.write(JSON.stringify(process.argv));\n');
  const isolated = await import(pathToFileURL(join(copied, 'install.ts')).href);
  const command = isolated.binCommand();
  const result = spawnSync('sh', ['-c', `${command} hook Stop`], { cwd: f.cwd, env: process.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const args = JSON.parse(result.stdout);
  assert.equal(args[0], process.execPath);
  assert.equal(args[1], realpathSync(join(copied, 'cli.ts')));
  assert.deepEqual(args.slice(2), ['hook', 'Stop']);
});

test('an explicit HEADSTART_BIN is preserved exactly and an empty override is refused', t => {
  const override = 'env CUSTOM_MODE=1 "/absolute custom/bin/headstart"';
  const f = fixture(t, override);
  assert.equal(binCommand(), override);
  install(f.cwd);
  assert.equal(f.read('claude').hooks.Stop[0].hooks[0].command, `${override} hook Stop`);
  process.env.HEADSTART_BIN = '';
  const before = readFileSync(f.paths.claude, 'utf8');
  assert.throws(() => install(f.cwd), /HEADSTART_BIN/);
  assert.equal(readFileSync(f.paths.claude, 'utf8'), before);
});
