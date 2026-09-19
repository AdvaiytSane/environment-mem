export function maskString(str, visible = 4) {
  if (str.length <= visible) return str;
  return '*'.repeat(str.length - visible) + str.slice(-visible);
}
