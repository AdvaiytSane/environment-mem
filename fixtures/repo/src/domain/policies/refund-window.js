const REFUND_WINDOW_DAYS = 30;

export function isWithinRefundWindow(order, now = new Date()) {
  const created = new Date(order.createdAt);
  const diffMs = new Date(now).getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= REFUND_WINDOW_DAYS;
}
