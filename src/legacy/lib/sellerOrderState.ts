export function canReviewNewSellerOrder(
  order: { status: string; seller_done_at?: string | null },
  refreshed: boolean,
) {
  return refreshed && order.status === 'pending' && !order.seller_done_at;
}