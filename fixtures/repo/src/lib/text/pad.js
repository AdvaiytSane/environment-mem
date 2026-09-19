export function padLeft(str, width, char = ' ') {
  return String(str).padStart(width, char);
}

export function padRight(str, width, char = ' ') {
  return String(str).padEnd(width, char);
}
