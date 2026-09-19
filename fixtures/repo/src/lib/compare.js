export function compareNumbers(a, b) {
  return a - b;
}

export function compareStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
