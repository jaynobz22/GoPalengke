import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraStorePickupFee, lockedGroupRider, EXTRA_PICKUP_FEE } from './multiStoreRider';

test('extra store pickup costs ₱10', () => {
  assert.equal(EXTRA_PICKUP_FEE, 10);
  assert.equal(extraStorePickupFee(false, 2), 10);
});
test('primary store or single store has no extra pickup fee', () => {
  assert.equal(extraStorePickupFee(true, 3), 0);
  assert.equal(extraStorePickupFee(false, 1), 0);
});
test('sibling store rider locks the picker', () => {
  assert.equal(lockedGroupRider([{ rider_id: null }, { rider_id: 'r1', status: 'accepted' }]), 'r1');
  assert.equal(lockedGroupRider([{ rider_id: 'r2', status: 'cancelled' }]), null);
});
