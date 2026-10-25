import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateFleetFare, fleetVehicleForWeight, FLEET_FARE_RATES } from './fleetFareReference';

test('tricycle: base fare covers first 3 km, min fare applies', () => {
  const e = estimateFleetFare('tricycle', 2, 30);
  assert.equal(e.distanceCharge, 0);
  assert.equal(e.weightCharge, 0);
  assert.equal(e.suggested, FLEET_FARE_RATES.tricycle.minFare);
});

test('tricycle: charges per km beyond base km', () => {
  const e = estimateFleetFare('tricycle', 8, 30);
  assert.equal(e.distanceCharge, (8 - 3) * 25);
  assert.equal(e.suggested, 120 + 125);
});

test('tricycle: adds weight charge beyond 50 kg free allowance', () => {
  const e = estimateFleetFare('tricycle', 2, 100);
  assert.equal(e.weightCharge, (100 - 50) * 1.5);
  assert.equal(e.suggested, 195);
});

test('minivan: uses higher base and per-km rates', () => {
  const e = estimateFleetFare('minivan', 10, 200);
  assert.equal(e.distanceCharge, (10 - 3) * 35);
  assert.equal(e.weightCharge, (200 - 150) * 1.0);
  assert.equal(e.suggested, 350 + 245 + 50);
});

test('minivan: min fare floor applies on short light trips', () => {
  const e = estimateFleetFare('minivan', 1, 50);
  assert.equal(e.suggested, FLEET_FARE_RATES.minivan.minFare);
});

test('low/high range brackets the suggested fare', () => {
  const e = estimateFleetFare('tricycle', 12, 80);
  assert.ok(e.low <= e.suggested);
  assert.ok(e.high >= e.suggested);
});

test('handles invalid input safely', () => {
  const e = estimateFleetFare('tricycle', NaN as any, -5);
  assert.equal(e.distanceKm, 0);
  assert.equal(e.weightKg, 0);
  assert.equal(e.suggested, FLEET_FARE_RATES.tricycle.minFare);
});

test('picks minivan for cargo over 150 kg, tricycle otherwise', () => {
  assert.equal(fleetVehicleForWeight(100), 'tricycle');
  assert.equal(fleetVehicleForWeight(151), 'minivan');
});
