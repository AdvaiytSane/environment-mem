export function loyaltyTier(orderCount) {
  if (orderCount >= 10) return 'gold';
  if (orderCount >= 5) return 'silver';
  return 'bronze';
}
