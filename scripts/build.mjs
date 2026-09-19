import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src');
const destination = join(root, 'dist');

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}

for (const input of files(source).sort()) {
  const output = join(destination, relative(source, input).replace(/\.ts$/, '.js'));
  const stripped = stripTypeScriptTypes(readFileSync(input, 'utf8'), { mode: 'strip' });
  const javascript = stripped
    // Runtime imports must resolve the emitted JavaScript under node_modules.
    .replace(/((?:from\s*|import\s*\(\s*)['"])(\.{1,2}\/[^'"\n]+)\.ts(['"])/g, '$1$2.js$3')
    .replace(/(import\s*['"])(\.{1,2}\/[^'"\n]+)\.ts(['"])/g, '$1$2.js$3')
    // The CLI installer and evaluation harness locate their sibling CLI at
    // runtime. Those URLs must point to dist/cli.js in an installed package.
    .replace(/(new URL\(\s*['"])(\.{1,2}\/[^'"\n]+)\.ts(['"]\s*,\s*import\.meta\.url\))/g, '$1$2.js$3');
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, javascript);
  renameSync(temporary, output);
}
