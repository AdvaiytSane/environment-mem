export function createRateLimiter(limit, windowMs) {
  const hits = new Map();
  return function allow(key) {
    const nowMs = Date.now();
    const timestamps = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
    if (timestamps.length >= limit) {
      hits.set(key, timestamps);
      return false;
    }
    timestamps.push(nowMs);
    hits.set(key, timestamps);
    return true;
  };
}
