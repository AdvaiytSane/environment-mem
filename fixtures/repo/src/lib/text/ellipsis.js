export function ellipsis(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}
