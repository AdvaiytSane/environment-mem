export function zip(a, b) {
  const length = Math.min(a.length, b.length);
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push([a[i], b[i]]);
  }
  return result;
}
