const TAX_RATES = { CA: 0.0725, NY: 0.08, WA: 0.065 };

export function taxCents(amountCents, state) {
  const rate = TAX_RATES[state] ?? 0;
  return Math.round(amountCents * rate);
}
