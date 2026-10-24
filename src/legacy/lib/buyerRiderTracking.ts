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

/** Polling must carry GPS/payment/completion changes, not only status changes. */
export function mergeBuyerOrderUpdate<T extends object>(previous: T, incoming: Partial<T>): T {
  const changed = Object.entries(incoming).some(([key, value]) =>
    !Object.is(previous[key as keyof T], value));
  return changed ? { ...previous, ...incoming } : previous;
}

export function interpolateRiderPosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  progress: number,
): { lat: number; lng: number } {
  const t = Math.min(1, Math.max(0, progress));
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}