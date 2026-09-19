export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isString(value) {
  return typeof value === 'string';
}
