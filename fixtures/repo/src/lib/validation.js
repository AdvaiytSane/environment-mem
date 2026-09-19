export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEmail(value) {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
