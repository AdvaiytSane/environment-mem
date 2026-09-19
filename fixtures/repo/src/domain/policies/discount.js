export function loyaltyDiscount(orderCount) {
  if (orderCount >= 10) return 0.15;
  if (orderCount >= 5) return 0.1;
  if (orderCount >= 2) return 0.05;
  return 0;
}
