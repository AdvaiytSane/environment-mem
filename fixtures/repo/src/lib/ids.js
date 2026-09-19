let counter = 0;

export function generateId(prefix = 'id') {
  counter += 1;
  return prefix + '_' + Date.now().toString(36) + '_' + counter.toString(36);
}

export function isValidId(id, prefix) {
  if (typeof id !== 'string') return false;
  return prefix ? id.startsWith(prefix + '_') : /^[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/.test(id);
}
