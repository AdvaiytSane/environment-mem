export function indent(str, spaces = 2) {
  const prefix = ' '.repeat(spaces);
  return str
    .split('\n')
    .map((line) => (line.length ? prefix + line : line))
    .join('\n');
}
