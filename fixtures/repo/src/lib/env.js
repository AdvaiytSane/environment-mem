export function getEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error('Missing required env var: ' + name);
  }
  return value;
}
