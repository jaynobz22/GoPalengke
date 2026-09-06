export const BASE_DELIVERY_FEE = 50;
export const PER_KM_RATE = 15;

export interface LocationInfo {
  barangay: string | null;
  city: string | null;
  region: string | null;
}

export function estimateDistanceKm(
  store: LocationInfo | null,
  delivery: LocationInfo | null,
): number {
  if (!store || !delivery) return 3;
  if (!store.city || !delivery.city) return 3;

  if (store.barangay && delivery.barangay &&
      store.barangay === delivery.barangay &&
      store.city === delivery.city) {
    return 1;
  }

  if (store.city === delivery.city) {
    return 2;
  }

  if (store.region && delivery.region && store.region === delivery.region) {
    return 4;
  }

  return 6;
}

export function computeDeliveryFee(
  store: LocationInfo | null,
  delivery: LocationInfo | null,
): number {
  const km = estimateDistanceKm(store, delivery);
  return BASE_DELIVERY_FEE + PER_KM_RATE * km;
}
