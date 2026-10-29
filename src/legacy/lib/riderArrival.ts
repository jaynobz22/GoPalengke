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

/** COD: the seller must confirm receipt (Payment Received) before the rider can mark delivered. */
export function canMarkRiderDelivered(orders: ArrivalOrder[]): boolean {
  return orders.length > 0 && orders.every(order => order.status === 'picked_up'
    && !!order.rider_arrived_buyer_at
    && (order.payment_method !== 'cod' || !!order.cod_payment_accepted_at));
}