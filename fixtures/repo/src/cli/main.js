import { COMMANDS } from './commands/index.js';
import { parseArgs } from './args.js';
import { FLAGS } from './flags.js';

export function run(argv) {
  const [commandName, ...rest] = argv;
  if (!commandName || !COMMANDS[commandName]) {
    console.error('Unknown command: ' + (commandName ?? '(none)'));
    console.error('Available commands: ' + Object.keys(COMMANDS).join(', '));
    process.exitCode = 1;
    return;
  }
  const command = COMMANDS[commandName];
  let args;
  try {
    args = parseArgs(commandName, rest, FLAGS);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  command.run(args);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run(process.argv.slice(2));
}
