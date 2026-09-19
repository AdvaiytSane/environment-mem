export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)) + '...';
}
