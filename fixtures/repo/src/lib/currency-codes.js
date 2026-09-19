export const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];

export function isValidCurrency(code) {
  return CURRENCY_CODES.includes(code);
}
