// Browser-safe summary of a seller's orders for the dashboard "Kita" and "Pending" cards.
// Kept separate from SellerApp so the rules are independently testable.

export interface DashboardOrderRow {
  total?: number | string | null;
  status?: string | null;
}

export interface SellerDashboardStats {
  /** Orders still waiting for the seller (status = 'pending'). */
  pending: number;
  /** Earnings: sum of every non-cancelled order total. */
  revenue: number;
}

export function sellerDashboardStats(orders: DashboardOrderRow[] | null | undefined): SellerDashboardStats {
  const rows = orders || [];
  let pending = 0;
  let revenue = 0;
  for (const o of rows) {
    if (o.status === 'pending') pending += 1;
    if (o.status !== 'cancelled') revenue += Number(o.total) || 0;
  }
  return { pending, revenue };
}
