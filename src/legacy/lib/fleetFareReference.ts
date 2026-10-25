// Fair fare reference para sa Bao-Bao/Tricycle at Minivan riders.
// Ang mga rate ay hinango sa presyuhan ng Lalamove at Transportify (PH)
// para may patas na basehan ang rider sa pagsingil base sa bigat, layo,
// gasolina, at oras — hindi ito awtomatikong singil, gabay lamang.

export type FleetFareVehicle = 'tricycle' | 'minivan';

export interface FleetFareRate {
  label: string;
  baseFare: number;      // sakop na ang unang BASE_KM
  baseKm: number;
  perKm: number;         // bawat km lampas sa baseKm
  freeWeightKg: number;  // bigat na walang dagdag
  perKg: number;         // dagdag bawat kg lampas sa freeWeightKg
  minFare: number;       // pinakamababang patas na singil
}

// Reperensya: Lalamove MPV 300kg / Transportify economy (tricycle),
// Lalamove 600kg MPV / Transportify small van (minivan).
export const FLEET_FARE_RATES: Record<FleetFareVehicle, FleetFareRate> = {
  tricycle: { label: 'Bao-Bao / Tricycle', baseFare: 120, baseKm: 3, perKm: 25, freeWeightKg: 50, perKg: 1.5, minFare: 150 },
  minivan: { label: 'Minivan', baseFare: 350, baseKm: 3, perKm: 35, freeWeightKg: 150, perKg: 1.0, minFare: 400 },
};

// Saklaw ng patas na singil: ±10-15% para sa gasolina, traffic, at oras.
export const FARE_LOW_FACTOR = 0.9;
export const FARE_HIGH_FACTOR = 1.15;

export interface FleetFareEstimate {
  vehicle: FleetFareVehicle;
  vehicleLabel: string;
  distanceKm: number;
  weightKg: number;
  baseFare: number;
  distanceCharge: number;
  weightCharge: number;
  suggested: number; // gitnang patas na singil
  low: number;       // pinakamababang patas
  high: number;      // pinakamataas na patas
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Kalkulahin ang patas na saklaw ng singil para sa bao-bao/minivan.
 * Gabay lamang ito — ang rider at buyer pa rin ang magkakasundo sa final na bayad.
 */
export function estimateFleetFare(
  vehicle: FleetFareVehicle,
  distanceKm: number,
  weightKg: number,
): FleetFareEstimate {
  const rate = FLEET_FARE_RATES[vehicle];
  const km = Number.isFinite(Number(distanceKm)) ? Math.max(0, Number(distanceKm)) : 0;
  const kg = Number.isFinite(Number(weightKg)) ? Math.max(0, Number(weightKg)) : 0;

  const distanceCharge = km <= rate.baseKm ? 0 : (km - rate.baseKm) * rate.perKm;
  const weightCharge = kg <= rate.freeWeightKg ? 0 : (kg - rate.freeWeightKg) * rate.perKg;

  const raw = Math.max(rate.minFare, rate.baseFare + distanceCharge + weightCharge);
  const suggested = round5(raw);
  const low = round5(raw * FARE_LOW_FACTOR);
  const high = round5(raw * FARE_HIGH_FACTOR);

  return {
    vehicle,
    vehicleLabel: rate.label,
    distanceKm: round2(km),
    weightKg: round2(kg),
    baseFare: rate.baseFare,
    distanceCharge: round2(distanceCharge),
    weightCharge: round2(weightCharge),
    suggested,
    low: Math.min(low, suggested),
    high: Math.max(high, suggested),
  };
}

/** Piliin ang sasakyan base sa bigat: >150kg → minivan, else tricycle. */
export function fleetVehicleForWeight(weightKg: number): FleetFareVehicle {
  return weightKg > 150 ? 'minivan' : 'tricycle';
}
