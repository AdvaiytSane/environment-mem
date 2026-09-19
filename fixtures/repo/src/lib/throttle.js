export function throttle(fn, ms) {
  let last = 0;
  return function throttled(...args) {
    const nowMs = Date.now();
    if (nowMs - last >= ms) {
      last = nowMs;
      return fn(...args);
    }
    return undefined;
  };
}
