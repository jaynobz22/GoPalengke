// === Tiered delivery fee model ===
// Two pricing zones: NCR (Metro Manila) and Provinces (Davao + all others).
// Each zone has a base distance fee for the first 2 km, a per-km rate beyond that,
// and a weight surcharge rate for cargo exceeding the 5 kg free allowance.

export const FREE_WEIGHT_KG = 5.0;

export interface ZoneRates {
  baseFee: number;       // flat fee for first 2 km
  perKmRate: number;     // per km beyond 2 km
  weightSurchargeRate: number; // per excess kg beyond 5 kg
}

export const NCR_RATES: ZoneRates = { baseFee: 60, perKmRate: 12, weightSurchargeRate: 2.0 };
export const PROVINCE_RATES: ZoneRates = { baseFee: 50, perKmRate: 10, weightSurchargeRate: 1.5 };

// NCR PSGC region code starts with "13"
const NCR_PREFIX = '13';

// Cities that are part of Metro Manila / NCR (for legacy text-based region matching)
const NCR_CITIES = new Set([
  'Quezon City', 'Manila', 'Makati', 'Makati City', 'Taguig', 'Taguig City',
  'Pasig', 'Pasig City', 'Caloocan', 'Las Piñas', 'Mandaluyong', 'Marikina',
  'Muntinlupa', 'Parañaque', 'Valenzuela', 'Malabon', 'Navotas', 'Pateros',
  'San Juan',
]);

/**
 * Determine whether a store/location falls in the NCR pricing zone.
 * Checks the PSGC region code first (starts with "13"), then falls back
 * to city-name matching for legacy data.
 */
export function isNcrRegion(region: string | null | undefined, city: string | null | undefined): boolean {
  if (region) {
    // PSGC codes are 10-digit; NCR = 1300000000
    if (/^\d{10}$/.test(region) && region.startsWith(NCR_PREFIX)) return true;
    // Legacy text-based region names
    const r = region.toLowerCase();
    if (r === 'ncr' || r.includes('national capital') || r.includes('metro manila')) return true;
  }
  if (city && NCR_CITIES.has(city)) return true;
  return false;
}

/** Get the zone-specific rates for a store location. */
export function getZoneRates(region: string | null | undefined, city: string | null | undefined): ZoneRates {
  return isNcrRegion(region, city) ? NCR_RATES : PROVINCE_RATES;
}

/**
 * Compute the distance charge component of the delivery fee.
 * First 2 km are included in the base fee; beyond that the per-km rate applies.
 */
export function computeDistanceCharge(distanceKm: number, rates: ZoneRates): number {
  if (distanceKm <= 2.0) return rates.baseFee;
  return rates.baseFee + (distanceKm - 2.0) * rates.perKmRate;
}

/**
 * Compute the weight surcharge for cargo exceeding the free weight allowance.
 * Returns 0 if total weight is within the 5 kg allowance.
 */
export function computeWeightSurcharge(totalWeightKg: number, rates: ZoneRates): number {
  if (totalWeightKg <= FREE_WEIGHT_KG) return 0;
  return (totalWeightKg - FREE_WEIGHT_KG) * rates.weightSurchargeRate;
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Full tiered delivery fee computation.
 * Returns the distance charge, weight surcharge, and total — all rounded to 2 dp.
 */
export function computeTieredDeliveryFee(
  distanceKm: number,
  totalWeightKg: number,
  region: string | null | undefined,
  city: string | null | undefined,
): { distanceCharge: number; weightSurcharge: number; total: number; isNcr: boolean } {
  const rates = getZoneRates(region, city);
  const isNcr = isNcrRegion(region, city);
  const distanceCharge = round2(computeDistanceCharge(distanceKm, rates));
  const weightSurcharge = round2(computeWeightSurcharge(totalWeightKg, rates));
  return { distanceCharge, weightSurcharge, total: round2(distanceCharge + weightSurcharge), isNcr };
}

// Legacy constants kept for backward compatibility with callers that haven't been
// updated yet (e.g. RiderNavigationMap live estimate). These are now derived from
// the province rates as a reasonable default.
export const BASE_DELIVERY_FEE = PROVINCE_RATES.baseFee;
export const PER_KM_RATE = PROVINCE_RATES.perKmRate;

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
// Verified via OpenStreetMap Nominatim geocoding — do not approximate
const PALENGKE_COORDS: Record<string, Coords> = {
  // Davao City
  'Agdao Public Market': { lat: 7.0818, lng: 125.6233 },
  'Bankerohan Public Market': { lat: 7.0760, lng: 125.6050 },
  'Buhangin Public Market': { lat: 7.1122, lng: 125.6234 },
  'Bunawan Public Market': { lat: 7.2362, lng: 125.6397 },
  'Calinan Public Market': { lat: 7.1909, lng: 125.4545 },
  'Matina Public Market': { lat: 7.0561, lng: 125.5773 },
  'Mintal Public Market': { lat: 7.0925, lng: 125.5025 },
  'Toril Public Market': { lat: 7.0183, lng: 125.4960 },
  'Cabaguio Public Market': { lat: 7.0820, lng: 125.6050 },
  'Lanang Public Market': { lat: 7.0980, lng: 125.6300 },
  // Quezon City
  'Balintawak Public Market': { lat: 14.6564, lng: 121.0025 },
  'Commonwealth Public Market': { lat: 14.6954, lng: 121.0870 },
  'Farmers Market (Cubao)': { lat: 14.6193, lng: 121.0524 },
  'Muñoz Public Market': { lat: 14.6680, lng: 121.0150 },
  'Novaliches Public Market': { lat: 14.6990, lng: 121.0330 },
  'Tandang Sora Public Market': { lat: 14.6759, lng: 121.0433 },
  // Manila
  'Divisoria Public Market': { lat: 14.6020, lng: 120.9690 },
  'Quintuple Public Market': { lat: 14.6100, lng: 120.9800 },
  'Pritil Public Market': { lat: 14.6179, lng: 120.9698 },
  'Santa Ana Public Market': { lat: 14.5819, lng: 121.0120 },
  'Dagupan-Binondo Market': { lat: 14.5990, lng: 120.9760 },
  // Makati
  'Guadalupe Public Market': { lat: 14.5660, lng: 121.0459 },
  'Poblacion Public Market': { lat: 14.5652, lng: 121.0336 },
  'Bangkal Public Market': { lat: 14.5432, lng: 121.0109 },
  // Pasig
  'Pasig Palengke': { lat: 14.5578, lng: 121.0838 },
  'Kapasigan Public Market': { lat: 14.5570, lng: 121.0830 },
  'Pinagbuhatan Public Market': { lat: 14.5300, lng: 121.0900 },
  // Taguig
  'Taguig Public Market': { lat: 14.4882, lng: 121.0609 },
  'Lower Bicutan Public Market': { lat: 14.4880, lng: 121.0600 },
  'Tipas Public Market': { lat: 14.5200, lng: 121.0500 },
  // Cebu City
  'Carbon Public Market': { lat: 10.2920, lng: 123.8978 },
  'Pasil Fish Port & Market': { lat: 10.2896, lng: 123.8918 },
  'Mambaling Public Market': { lat: 10.2950, lng: 123.8800 },
  'Taboan Public Market': { lat: 10.2955, lng: 123.8911 },
  // Iloilo City
  'La Paz Public Market': { lat: 10.7094, lng: 122.5677 },
  'Jaro Public Market': { lat: 10.7219, lng: 122.5549 },
  'Central Market (Super)': { lat: 10.7202, lng: 122.5621 },
  'Mandurriao Public Market': { lat: 10.7163, lng: 122.5365 },
  // Cagayan de Oro
  'Cogon Public Market': { lat: 8.4774, lng: 124.6515 },
  'Carmen Public Market': { lat: 8.4792, lng: 124.6367 },
  'Bulua Public Market': { lat: 8.5112, lng: 124.6236 },
  'Macabalan Fish Port': { lat: 8.4900, lng: 124.6700 },
  // Zamboanga City
  'Barasta Public Market': { lat: 6.9100, lng: 122.0700 },
  'Putik Public Market': { lat: 6.9400, lng: 122.0600 },
  'Veterans Public Market': { lat: 6.9200, lng: 122.0800 },
  // General Santos
  'Gensan Public Market': { lat: 6.1164, lng: 125.1716 },
  'Labangal Fish Port & Market': { lat: 6.0800, lng: 125.1600 },
  'Fatima Public Market': { lat: 6.1300, lng: 125.1800 },
  // Baguio City
  'Baguio City Public Market': { lat: 16.4159, lng: 120.5950 },
  'Hangar Market': { lat: 16.4165, lng: 120.5954 },
  'Hilltop Market': { lat: 16.4152, lng: 120.5947 },
  // Naga City
  "Naga City People's Mall": { lat: 13.6210, lng: 123.1837 },
  'Naga Central Market': { lat: 13.6230, lng: 123.1850 },
  // Legazpi City
  'Legazpi City Public Market': { lat: 13.1469, lng: 123.7504 },
  'Albay Public Market': { lat: 13.1400, lng: 123.7400 },
  // Malabon
  'Malabon Public Market': { lat: 14.6631, lng: 120.9568 },
  // Navotas
  'Navotas Fish Port Complex': { lat: 14.6430, lng: 120.9511 },
};

// Approximate city center coordinates for major Philippine cities
export const CITY_COORDS: Record<string, Coords> = {
  'Davao City': { lat: 7.0907, lng: 125.6128 },
  'Quezon City': { lat: 14.6760, lng: 121.0437 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Cebu City': { lat: 10.3157, lng: 123.8854 },
  'Makati': { lat: 14.5547, lng: 121.0244 },
  'Makati City': { lat: 14.5547, lng: 121.0244 },
  'Taguig': { lat: 14.5176, lng: 121.0509 },
  'Taguig City': { lat: 14.5176, lng: 121.0509 },
  'Pasig': { lat: 14.5764, lng: 121.0851 },
  'Pasig City': { lat: 14.5764, lng: 121.0851 },
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
 *
 * IMPORTANT: Only returns city-center coords when we have no other choice.
 * Callers that need a delivery fee should check hasExactCoords() first —
 * using city-center coords for haversine can produce absurd distances
 * (e.g. a store at Mintal Public Market is 23.5km from Davao City center).
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

  // Fall back to city center — callers should prefer text-based estimation
  // when no exact pin is available, to avoid misleading haversine distances
  if (delivery.city && CITY_COORDS[delivery.city]) {
    return CITY_COORDS[delivery.city];
  }

  return null;
}

/**
 * Returns true only when we have an exact pin for the delivery location.
 * Use this to decide whether to use coordinate-based fee calculation
 * or fall back to text-based estimation.
 */
export function hasExactDeliveryCoords(delivery: {
  lat?: number | null;
  lng?: number | null;
}): boolean {
  return delivery.lat != null && delivery.lng != null;
}

/**
 * Calculate delivery fee from coordinates using Haversine distance.
 * Returns { fee, distanceKm } or null if coordinates are unavailable.
 */
export function computeDeliveryFeeFromCoords(
  storeCoords: Coords,
  deliveryCoords: Coords,
  region?: string | null,
  city?: string | null,
  totalWeightKg?: number,
): { fee: number; distanceKm: number; distanceCharge: number; weightSurcharge: number } {
  const distanceKm = haversineKm(storeCoords, deliveryCoords);
  const rates = getZoneRates(region, city);
  const distanceCharge = round2(computeDistanceCharge(distanceKm, rates));
  const weightSurcharge = round2(computeWeightSurcharge(totalWeightKg || 0, rates));
  return {
    fee: round2(distanceCharge + weightSurcharge),
    distanceKm: round2(distanceKm),
    distanceCharge,
    weightSurcharge,
  };
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
  totalWeightKg?: number,
): number {
  const km = estimateDistanceKm(store, delivery);
  const rates = getZoneRates(store?.region, store?.city);
  const distanceCharge = computeDistanceCharge(km, rates);
  const weightSurcharge = computeWeightSurcharge(totalWeightKg || 0, rates);
  return round2(distanceCharge + weightSurcharge);
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
  instructions: { text: string; distance: string; step: number }[];
}

/**
 * Fetch a driving route from OSRM. Returns road distance, ETA, polyline
 * coordinates, and turn-by-turn instructions. Falls back to haversine
 * straight-line if OSRM is unreachable.
 */
export async function fetchRoute(from: Coords, to: Coords): Promise<RouteResult> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`,
    );
    if (!res.ok) throw new Error('Route request failed');
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('No route found');

    const route = data.routes[0];
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]],
    );

    const instructions: { text: string; distance: string; step: number }[] = [];
    if (route.legs && route.legs[0]?.steps) {
      let stepNum = 1;
      for (const step of route.legs[0].steps) {
        const maneuver = step.maneuver;
        if (!maneuver || maneuver.type === 'depart' || maneuver.type === 'arrive') continue;
        const text = maneuver.modifier
          ? `${capitalize(maneuver.modifier)} sa ${step.name || 'next street'}`
          : maneuver.type === 'turn'
            ? `Mag-turn sa ${step.name || 'next street'}`
            : `I-tuloy sa ${step.name || 'next street'}`;
        instructions.push({
          text,
          distance: step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance / 1000).toFixed(1)}km`,
          step: stepNum++,
        });
      }
    }

    return {
      coordinates,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round(route.duration / 60),
      instructions,
    };
  } catch {
    // Fallback: straight-line distance
    const distKm = haversineKm(from, to);
    return {
      coordinates: [[from.lat, from.lng], [to.lat, to.lng]],
      distanceKm: Math.round(distKm * 100) / 100,
      durationMin: Math.round((distKm / 30) * 60),
      instructions: [],
    };
  }
}

/**
 * Fetch road distance only (for checkout fee calculation without needing
 * the full route geometry). Falls back to haversine.
 */
export async function fetchRoadDistance(from: Coords, to: Coords): Promise<{ distanceKm: number; durationMin: number }> {
  const route = await fetchRoute(from, to);
  return { distanceKm: route.distanceKm, durationMin: route.durationMin };
}

/**
 * Return palengke names sorted by distance from a reference location.
 * Uses the PALENGKE_COORDS lookup and haversine distance. Returns up to `limit`
 * results. If no reference coords are available, returns all palengkes for the
 * given city (or all known palengkes) in their original order.
 */
export function getNearbyPalengkes(
  ref: Coords | null,
  city: string | null,
  limit = 5,
): { name: string; distanceKm: number }[] {
  const entries = Object.entries(PALENGKE_COORDS);

  // If we have a reference point, sort all known palengkes by distance
  if (ref) {
    return entries
      .map(([name, coords]) => ({
        name,
        distanceKm: Math.round(haversineKm(ref, coords) * 10) / 10,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }

  // No reference coords — filter by city from MARKET_NAMES if available
  // (imported lazily to avoid circular dependency with types.ts)
  let names: string[] | null = null;
  if (city) {
    try {
      const mod = (TYPES_MODULE as any);
      if (mod && mod.MARKET_NAMES && mod.MARKET_NAMES[city]) {
        names = mod.MARKET_NAMES[city];
      }
    } catch { /* ignore */ }
  }

  if (names) {
    return names
      .filter(n => PALENGKE_COORDS[n])
      .map(n => ({ name: n, distanceKm: 0 }))
      .slice(0, limit);
  }

  // Fall back to all known palengke names
  return entries
    .map(([name]) => ({ name, distanceKm: 0 }))
    .slice(0, limit);
}

// Lazy reference to types module for MARKET_NAMES lookup
import * as TYPES_MODULE from './types';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
