export function flatten(arrays) {
  return arrays.reduce((flat, arr) => flat.concat(arr), []);
}
