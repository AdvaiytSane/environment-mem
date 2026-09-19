export function sortBy(array, key) {
  return [...array].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
}

export function sortByDesc(array, key) {
  return sortBy(array, key).reverse();
}
