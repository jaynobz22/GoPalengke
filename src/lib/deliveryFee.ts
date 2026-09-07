export const BASE_DELIVERY_FEE = 50;
export const PER_KM_RATE = 15;

export interface LocationInfo {
  barangay: string | null;
  city: string | null;
  region: string | null;
}

export interface Coords {
  lat: number;
  lng: number;
}

// Known Philippine public market GPS coordinates
const PALENGKE_COORDS: Record<string, Coords> = {
  // Davao City
  'Mintal Public Market': { lat: 7.1617, lng: 125.4120 },
  'Matina Public Market': { lat: 7.0790, lng: 125.4560 },
  'Agdao Public Market': { lat: 7.0820, lng: 125.6330 },
  'Bankerohan Public Market': { lat: 7.0760, lng: 125.6050 },
  'Buhangin Public Market': { lat: 7.0980, lng: 125.6300 },
  'Bunawan Public Market': { lat: 7.0400, lng: 125.6700 },
  'Calinan Public Market': { lat: 7.1750, lng: 125.3450 },
  'Toril Public Market': { lat: 7.0000, lng: 125.4900 },
  'Cabaguio Public Market': { lat: 7.0900, lng: 125.5800 },
  'Lanang Public Market': { lat: 7.0900, lng: 125.6400 },
};

// Approximate city center coordinates for major Philippine cities
const CITY_COORDS: Record<string, Coords> = {
  'Davao City': { lat: 7.0907, lng: 125.6128 },
  'Quezon City': { lat: 14.6760, lng: 121.0437 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'Makati': { lat: 14.5547, lng: 121.0244 },
  'Taguig': { lat: 14.5176, lng: 121.0509 },
  'Pasig': { lat: 14.5764, lng: 121.0851 },
  'Caloocan': { lat: 14.6541, lng: 120.9846 },
  'Las Piñas': { lat: 14.4758, lng: 120.9846 },
  'Mandaluyong': { lat: 14.5794, lng: 121.0244 },
  'Marikina': { lat: 14.6507, lng: 121.1029 },
  'Muntinlupa': { lat: 14.3915, lng: 121.0437 },
  'Parañaque': { lat: 14.4793, lng: 121.0198 },
  'Valenzuela': { lat: 14.7000, lng: 120.9846 },
  'Malabon': { lat: 14.6631, lng: 120.9568 },
  'Navotas': { lat: 14.6458, lng: 120.9417 },
  'Pateros': { lat: 14.5176, lng: 121.0718 },
  'San Juan': { lat: 14.6042, lng: 121.0244 },
  'Tagaytay': { lat: 14.1153, lng: 120.9620 },
  'Antipolo': { lat: 14.6218, lng: 121.1228 },
  'Bacoor': { lat: 14.4590, lng: 120.9360 },
  'Imus': { lat: 14.4290, lng: 120.9410 },
  'Dasmariñas': { lat: 14.3310, lng: 120.9360 },
  'General Santos': { lat: 6.1164, lng: 125.1716 },
  'Zamboanga City': { lat: 6.9214, lng: 122.0790 },
  'Cagayan de Oro': { lat: 8.4542, lng: 124.6319 },
  'Iloilo City': { lat: 10.7202, lng: 122.5621 },
  'Bacolod': { lat: 10.6760, lng: 122.9620 },
  'Butuan': { lat: 8.9475, lng: 125.5406 },
  'Iligan': { lat: 8.2280, lng: 124.2450 },
  'Cotabato City': { lat: 7.2236, lng: 124.2460 },
  'Digos': { lat: 6.8260, lng: 125.3560 },
  'Tagum': { lat: 7.4480, lng: 125.8080 },
  'Panabo': { lat: 7.2990, lng: 125.6830 },
  'Mati': { lat: 6.9530, lng: 126.2180 },
};

// Approximate barangay offsets from city center (in km direction)
// Used when we have city coords but need a rough barangay-level estimate
const BARANGAY_OFFSET_KM = 1.5;

/**
 * Haversine formula — calculates the great-circle distance between two points
 * on Earth (specified in decimal degrees). Returns distance in kilometers.
 */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Look up coordinates for a store based on its palengke_name or city.
 * Returns null if no coordinates can be determined.
 */
export function getStoreCoords(store: {
  latitude?: number | null;
  longitude?: number | null;
  palengke_name?: string | null;
  barangay?: string | null;
  city?: string | null;
  region?: string | null;
}): Coords | null {
  // Prefer explicit store coordinates from the database
  if (store.latitude != null && store.longitude != null) {
    return { lat: store.latitude, lng: store.longitude };
  }

  // Try palengke name lookup
  if (store.palengke_name && PALENGKE_COORDS[store.palengke_name]) {
    return PALENGKE_COORDS[store.palengke_name];
  }

  // Fall back to city center
  if (store.city && CITY_COORDS[store.city]) {
    return CITY_COORDS[store.city];
  }

  return null;
}

/**
 * Look up approximate coordinates for a delivery location.
 * Returns null if no coordinates can be determined.
 */
export function getDeliveryCoords(delivery: {
  lat?: number | null;
  lng?: number | null;
  barangay?: string | null;
  city?: string | null;
  region?: string | null;
}): Coords | null {
  // Prefer explicit pin coordinates
  if (delivery.lat != null && delivery.lng != null) {
    return { lat: delivery.lat, lng: delivery.lng };
  }

  // Fall back to city center
  if (delivery.city && CITY_COORDS[delivery.city]) {
    return CITY_COORDS[delivery.city];
  }

  return null;
}

/**
 * Calculate delivery fee from coordinates using Haversine distance.
 * Returns { fee, distanceKm } or null if coordinates are unavailable.
 */
export function computeDeliveryFeeFromCoords(
  storeCoords: Coords,
  deliveryCoords: Coords,
): { fee: number; distanceKm: number } {
  const distanceKm = haversineKm(storeCoords, deliveryCoords);
  const fee = BASE_DELIVERY_FEE + PER_KM_RATE * distanceKm;
  return { fee: Math.round(fee * 100) / 100, distanceKm: Math.round(distanceKm * 100) / 100 };
}

/**
 * Legacy text-based distance estimation — used as fallback when coordinates
 * are not available. Returns a rough distance in km.
 */
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

/**
 * Legacy text-based delivery fee — used as fallback when coordinates
 * are not available.
 */
export function computeDeliveryFee(
  store: LocationInfo | null,
  delivery: LocationInfo | null,
): number {
  const km = estimateDistanceKm(store, delivery);
  return BASE_DELIVERY_FEE + PER_KM_RATE * km;
}
