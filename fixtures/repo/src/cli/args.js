export function parseArgs(command, argv, flagsTable) {
  const declared = flagsTable[command] ?? [];
  const byName = new Map(declared.map((flag) => [flag.name, flag]));
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const name = token.slice(2);
      const flag = byName.get(name);
      if (!flag) {
        throw new Error('Unknown flag --' + name + ' for command "' + command + '"');
      }
      if (flag.type === 'boolean') {
        result[name] = true;
      } else {
        const value = argv[i + 1];
        i += 1;
        if (value === undefined) {
          throw new Error('Flag --' + name + ' requires a value');
        }
        result[name] = flag.type === 'number' ? Number(value) : value;
      }
    } else {
      result._.push(token);
    }
  }
  return result;
}
