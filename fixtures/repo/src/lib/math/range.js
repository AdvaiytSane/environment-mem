export function range(start, end, step = 1) {
  const result = [];
  for (let value = start; value < end; value += step) {
    result.push(value);
  }
  return result;
}
