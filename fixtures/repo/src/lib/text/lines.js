export function splitLines(str) {
  return str.split(/\r?\n/);
}

export function countLines(str) {
  return splitLines(str).length;
}
