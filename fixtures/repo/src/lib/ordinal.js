export function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  const rem10 = n % 10;
  if (rem10 === 1) return n + 'st';
  if (rem10 === 2) return n + 'nd';
  if (rem10 === 3) return n + 'rd';
  return n + 'th';
}
