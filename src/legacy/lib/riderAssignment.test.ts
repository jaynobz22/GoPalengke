import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCarryCargo, cargoWeight, canDeclineAssignment } from './riderAssignment';

test('motorcycle allowed at 25kg but not above 25kg', () => {
  assert.equal(canCarryCargo('motorcycle', 25), true);
  assert.equal(canCarryCargo('motorcycle', 25.01), false);
  assert.equal(canCarryCargo(null, 26), false);
  assert.equal(canCarryCargo('tricycle', 26), true);
  assert.equal(canCarryCargo('minivan', 26), true);
});
test('combined store cargo excludes motorcycle even when each store is below 25kg', () => {
  const kg = cargoWeight([{ items: [{ quantity: 15, unit: 'kilo' }] }, { items: [{ quantity: 11, unit: 'kg' }] }]);
  assert.equal(kg, 26);
  assert.equal(canCarryCargo('motorcycle', kg), false);
});
test('cancelled stores do not contribute cargo and sacks weigh 25kg', () => {
  assert.equal(cargoWeight([{ items: [{ quantity: 1, unit: 'sack' }] }, { status: 'cancelled', items: [{ quantity: 5, unit: 'kg' }] }]), 25);
});
test('only the assigned rider can decline before acceptance without cancelling order', () => {
  const order = { rider_id: 'r1', status: 'ready_for_pickup', rider_accepted_at: null };
  assert.equal(canDeclineAssignment(order, 'r1'), true);
  assert.equal(canDeclineAssignment(order, 'r2'), false);
  assert.equal(canDeclineAssignment({ ...order, rider_accepted_at: '2026-10-29' }, 'r1'), false);
  assert.equal(canDeclineAssignment({ ...order, status: 'delivered' }, 'r1'), false);
});