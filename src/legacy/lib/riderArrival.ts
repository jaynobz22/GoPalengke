type ArrivalOrder = {
  status: string;
  payment_method: string;
  rider_arrived_buyer_at?: string | null;
  cod_payment_reference?: string | null;
  cod_payment_accepted_at?: string | null;
};

export function canMarkRiderArrival(order: ArrivalOrder): boolean {
  return order.status === 'picked_up' && !order.rider_arrived_buyer_at;
}

/** References acknowledge remittance, not bank verification by the seller. */
export function canMarkRiderDelivered(orders: ArrivalOrder[]): boolean {
  return orders.length > 0 && orders.every(order => order.status === 'picked_up'
    && !!order.rider_arrived_buyer_at
    && (order.payment_method !== 'cod' || !!order.cod_payment_reference?.trim() || !!order.cod_payment_accepted_at));
}