export function toCents(dollars) {
  return Math.round(dollars * 100);
}

export function toDollars(cents) {
  return cents / 100;
}

export function formatCents(cents, currency = 'USD') {
  const dollars = (cents / 100).toFixed(2);
  return currency === 'USD' ? '$' + dollars : dollars + ' ' + currency;
}

export function addCents(...values) {
  return values.reduce((sum, value) => sum + value, 0);
}
