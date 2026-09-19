export function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1];
  return head + ' and ' + tail;
}
