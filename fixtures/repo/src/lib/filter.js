export function filterBy(array, predicate) {
  const keys = Object.keys(predicate);
  return array.filter((item) => keys.every((key) => item[key] === predicate[key]));
}

export function excludeBy(array, predicate) {
  const keys = Object.keys(predicate);
  return array.filter((item) => !keys.every((key) => item[key] === predicate[key]));
}
