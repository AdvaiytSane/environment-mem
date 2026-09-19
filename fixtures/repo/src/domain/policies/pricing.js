export function applyDiscount(amountCents, discountRate) {
  return Math.round(amountCents * (1 - discountRate));
}
