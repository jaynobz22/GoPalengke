export const BASE_DELIVERY_FEE = 50;
export const PER_KM_RATE = 15;

export function estimateDistanceKm(storeCity: string | null, deliveryCity: string | null): number {
  if (!storeCity || !deliveryCity) return 3;
  return storeCity === deliveryCity ? 2 : 6;
}

export function computeDeliveryFee(storeCity: string | null, deliveryCity: string | null): number {
  const km = estimateDistanceKm(storeCity, deliveryCity);
  return BASE_DELIVERY_FEE + PER_KM_RATE * km;
}
