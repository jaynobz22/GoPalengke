// @ts-nocheck
// Bao-Bao / Minivan finder para sa buyer na maramihan ang bibilhin.
// Bao-bao (tricycle) at minivan lang ang kasama — hindi ang mga naka-motor.

export type FleetVehicleType = 'tricycle' | 'minivan';

export const FLEET_VEHICLE_TYPES: FleetVehicleType[] = ['tricycle', 'minivan'];

export const FLEET_VEHICLE_LABELS: Record<string, string> = {
  tricycle: 'Bao-Bao / Tricycle',
  minivan: 'Minivan',
};

export interface FleetRider {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  vehicle_type: string | null;
  rider_plate_number: string | null;
  rider_motor_model: string | null;
  city: string | null;
  barangay: string | null;
  region: string | null;
  is_available: boolean;
  is_active: boolean;
  is_approved: boolean;
}

/** Rider na puwedeng lumabas sa listahan: bao-bao/minivan, available, active, approved. */
export function isFleetRider(r: Partial<FleetRider> | null | undefined): boolean {
  if (!r) return false;
  return (
    FLEET_VEHICLE_TYPES.includes(r.vehicle_type as FleetVehicleType) &&
    r.is_available === true &&
    r.is_active === true &&
    r.is_approved === true
  );
}

/** I-sort: kaparehong city muna, sunod ang kaparehong region, tapos alphabetical. */
export function sortFleetRiders(
  riders: Partial<FleetRider>[],
  buyerCity?: string | null,
  buyerRegion?: string | null,
): FleetRider[] {
  const city = (buyerCity || '').toLowerCase();
  const region = (buyerRegion || '').toLowerCase();
  return riders
    .filter(isFleetRider)
    .sort((a, b) => {
      const aCity = city && (a.city || '').toLowerCase() === city ? 0 : 1;
      const bCity = city && (b.city || '').toLowerCase() === city ? 0 : 1;
      if (aCity !== bCity) return aCity - bCity;
      const aRegion = region && (a.region || '').toLowerCase() === region ? 0 : 1;
      const bRegion = region && (b.region || '').toLowerCase() === region ? 0 : 1;
      if (aRegion !== bRegion) return aRegion - bRegion;
      return (a.full_name || '').localeCompare(b.full_name || '');
    }) as FleetRider[];
}
