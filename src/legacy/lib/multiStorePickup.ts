type PickupOrder = {
  id: string; store_id: string; status: string; created_at?: string;
  picked_up_at?: string | null; rider_accepted_at?: string | null;
};

export function pickupRoute<T extends PickupOrder>(orders: T[]): T[] {
  return orders.filter(o => o.status !== 'cancelled').sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id));
}

export function hasStorePickup(order: PickupOrder): boolean {
  return !!order.picked_up_at || ['picked_up', 'delivered'].includes(order.status);
}

export function nextStoreTrip<T extends PickupOrder>(orders: T[]): { order: T; ordinal: number } | null {
  const route = pickupRoute(orders);
  if (route.length < 2 || !route.some(hasStorePickup)) return null;
  const index = route.findIndex(o => !hasStorePickup(o));
  const order = route[index];
  return !order ? null : { order, ordinal: route.filter(hasStorePickup).length + 1 };
}

export function canDepartToBuyer(orders: PickupOrder[]): boolean {
  const route = pickupRoute(orders);
  return route.length > 0 && route.every(o => !!o.rider_accepted_at && hasStorePickup(o));
}

export function canVisitPickup(orders: PickupOrder[], orderId: string, departedIds: Set<string>): boolean {
  const route = pickupRoute(orders);
  const order = route.find(o => o.id === orderId);
  if (!order || !order.rider_accepted_at || hasStorePickup(order)) return false;
  if (route.length === 1) return true;
  const next = route.find(o => !hasStorePickup(o));
  return next?.id === orderId && (!route.some(hasStorePickup) || departedIds.has(orderId));
}

export const STORE_TRIP_PREFIX = '🚚 Punta na ako sa ';
export function storeTripMessage(ordinal: number, name: string): string {
  return `${STORE_TRIP_PREFIX}${ordinal}${ordinal === 2 ? 'nd' : ordinal === 3 ? 'rd' : 'th'} tindahan — ${name}.`;
}

/** Stable message IDs make retries/reloads reuse the saved departure rather than notify twice. */
export async function storeTripMessageId(orderId: string, riderId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`store-trip:${orderId}:${riderId}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}