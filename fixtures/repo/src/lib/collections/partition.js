export function partition(items, predicate) {
  const pass = [];
  const fail = [];
  for (const item of items) {
    (predicate(item) ? pass : fail).push(item);
  }
  return [pass, fail];
}
