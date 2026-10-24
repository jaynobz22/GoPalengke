type PickupPaymentOrder = {
  status: string;
  payment_method: string;
  rider_id?: string | null;
  rider_accepted_at?: string | null;
  rider_arrived_store_at?: string | null;
  picked_up_at?: string | null;
};

/** Group pickup can retain ready_for_pickup until the rider departs for the buyer. */
export function canShowSellerRiderQr(order: PickupPaymentOrder): boolean {
  return order.payment_method === 'qr_code'
    && order.status === 'ready_for_pickup'
    && !!order.rider_id
    && !!order.rider_accepted_at
    && !!(order.rider_arrived_store_at || order.picked_up_at);
}