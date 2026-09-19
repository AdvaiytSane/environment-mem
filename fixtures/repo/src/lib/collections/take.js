export function take(items, count) {
  return items.slice(0, count);
}

export function takeLast(items, count) {
  return count === 0 ? [] : items.slice(-count);
}
