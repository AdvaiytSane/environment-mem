const PREFIXES = { USD: '$', EUR: 'EUR ', GBP: 'GBP ' };

export function formatCurrency(cents, currency = 'USD') {
  const prefix = PREFIXES[currency] ?? currency + ' ';
  return prefix + (cents / 100).toFixed(2);
}
