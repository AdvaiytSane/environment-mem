export function pluralize(word, count) {
  if (count === 1) return word;
  if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s')) return word + 'es';
  return word + 's';
}
