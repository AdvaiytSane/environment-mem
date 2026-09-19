export function formatPercent(fraction, digits = 0) {
  return (fraction * 100).toFixed(digits) + '%';
}
