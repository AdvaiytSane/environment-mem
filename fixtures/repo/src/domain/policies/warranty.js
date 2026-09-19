const WARRANTY_DAYS = 365;

export function isUnderWarranty(purchaseDate, now = new Date()) {
  const diffMs = new Date(now).getTime() - new Date(purchaseDate).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= WARRANTY_DAYS;
}
