export function stripTags(str) {
  return str.replace(/<[^>]*>/g, '');
}
