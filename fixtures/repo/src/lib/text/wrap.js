export function wrapText(str, width) {
  const words = str.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current.length ? current + ' ' + word : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
