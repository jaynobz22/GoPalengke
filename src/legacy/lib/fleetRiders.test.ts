import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFleetRider, sortFleetRiders, FLEET_VEHICLE_TYPES } from './fleetRiders';

const base = {
  id: 'r1',
  full_name: 'Juan Rider',
  avatar_url: null,
  phone: null,
  rider_plate_number: 'ABC 123',
  rider_motor_model: null,
  city: 'Davao City',
  barangay: 'Agdao',
  region: 'Region XI',
  is_available: true,
  is_active: true,
  is_approved: true,
};

test('kasama ang tricycle at minivan lang, hindi motorcycle', () => {
  assert.equal(isFleetRider({ ...base, vehicle_type: 'tricycle' }), true);
  assert.equal(isFleetRider({ ...base, vehicle_type: 'minivan' }), true);
  assert.equal(isFleetRider({ ...base, vehicle_type: 'motorcycle' }), false);
  assert.equal(isFleetRider({ ...base, vehicle_type: null }), false);
});

test('hindi lalabas ang hindi available, inactive, o hindi pa approved', () => {
  assert.equal(isFleetRider({ ...base, vehicle_type: 'tricycle', is_available: false }), false);
  assert.equal(isFleetRider({ ...base, vehicle_type: 'tricycle', is_active: false }), false);
  assert.equal(isFleetRider({ ...base, vehicle_type: 'tricycle', is_approved: false }), false);
});

test('kaparehong city ang una, sunod ang kaparehong region', () => {
  const riders = [
    { ...base, id: 'far', full_name: 'Far Rider', vehicle_type: 'minivan', city: 'Manila', region: 'NCR' },
    { ...base, id: 'near', full_name: 'Near Rider', vehicle_type: 'tricycle', city: 'Davao City', region: 'Region XI' },
    { ...base, id: 'mid', full_name: 'Mid Rider', vehicle_type: 'tricycle', city: 'Tagum', region: 'Region XI' },
  ];
  const sorted = sortFleetRiders(riders, 'Davao City', 'Region XI');
  assert.deepEqual(sorted.map(r => r.id), ['near', 'mid', 'far']);
});

test('sinasala ang hindi fleet riders bago i-sort', () => {
  const riders = [
    { ...base, id: 'moto', vehicle_type: 'motorcycle' },
    { ...base, id: 'trike', vehicle_type: 'tricycle' },
  ];
  const sorted = sortFleetRiders(riders, 'Davao City', 'Region XI');
  assert.deepEqual(sorted.map(r => r.id), ['trike']);
});

test('bao-bao (tricycle) at minivan lang ang fleet vehicles', () => {
  assert.deepEqual(FLEET_VEHICLE_TYPES, ['tricycle', 'minivan']);
});
