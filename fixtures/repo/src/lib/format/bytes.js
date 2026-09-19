const UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(bytes) {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return value.toFixed(unitIndex === 0 ? 0 : 1) + ' ' + UNITS[unitIndex];
}
