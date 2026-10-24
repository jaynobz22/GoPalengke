type BuyerTrackingOrder = {
  status: string;
  rider_id?: string | null;
  rider_accepted_at?: string | null;
};

/** Assignment is not acceptance. Picked-up orders already establish an active delivery. */
export function canShowBuyerRiderTracking(order: BuyerTrackingOrder): boolean {
  if (!order.rider_id) return false;
  return order.status === 'picked_up'
    || (order.status === 'ready_for_pickup' && !!order.rider_accepted_at);
}