const SUSPICIOUS_AMOUNT_CENTS = 100000;

export function isSuspicious(order) {
  return order.amountCents >= SUSPICIOUS_AMOUNT_CENTS;
}
