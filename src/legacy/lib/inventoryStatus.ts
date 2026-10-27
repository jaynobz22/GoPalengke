export type StockLevel = 'out' | 'low' | 'ok';

export const LOW_STOCK_MIN = 5;
export const LOW_STOCK_DAYS = 3;

/** soldLast30 = quantity sold in last 30 days. Low when ≤5 left or ≤3 days of selling left. */
export function stockLevel(stock: number, soldLast30 = 0): StockLevel {
  const s = Number(stock) || 0;
  if (s <= 0) return 'out';
  if (s <= LOW_STOCK_MIN) return 'low';
  const perDay = (Number(soldLast30) || 0) / 30;
  if (perDay > 0 && s / perDay <= LOW_STOCK_DAYS) return 'low';
  return 'ok';
}

export function daysLeft(stock: number, soldLast30 = 0): number | null {
  const perDay = (Number(soldLast30) || 0) / 30;
  if (perDay <= 0 || stock <= 0) return null;
  return Math.max(1, Math.round(stock / perDay));
}
