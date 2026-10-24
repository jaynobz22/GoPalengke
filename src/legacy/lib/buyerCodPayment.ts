export const DEFAULT_BUYER_COD_PAYMENT = 'qr' as const;
export function canShowBuyerCodPayment(order: {
  status: string; payment_method: string; rider_id?: string | null; rider_arrived_buyer_at?: string | null;
}): boolean {
  return order.status === 'picked_up' && order.payment_method === 'cod'
    && !!order.rider_id && !!order.rider_arrived_buyer_at;
}