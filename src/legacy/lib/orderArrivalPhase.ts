type ArrivalSnapshot = {
  status: string;
  rider_arrived_buyer_at?: string | null;
};

/** Arrival changes presentation only; it never advances the delivery status. */
export function orderArrivalPhase(order: ArrivalSnapshot): 'pending' | 'travelling' | 'arrived' | 'delivered' {
  if (order.status === 'delivered') return 'delivered';
  if (order.status !== 'picked_up') return 'pending';
  return order.rider_arrived_buyer_at ? 'arrived' : 'travelling';
}