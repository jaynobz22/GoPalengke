import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShowSellerRiderQr } from './sellerRiderQr';

const pickup = { status: 'ready_for_pickup', payment_method: 'qr_code', rider_id: 'rider-1', rider_accepted_at: '2026-10-24T23:00:00Z', rider_arrived_store_at: '2026-10-24T23:01:00Z' };

test('NON-COD rider QR becomes available at store arrival or grouped pickup, not before', () => {
  assert.equal(canShowSellerRiderQr({ ...pickup, rider_arrived_store_at: null }), false);
  assert.equal(canShowSellerRiderQr(pickup), true);
  assert.equal(canShowSellerRiderQr({ ...pickup, rider_arrived_store_at: null, picked_up_at: '2026-10-24T23:02:00Z' }), true);
  assert.equal(canShowSellerRiderQr({ ...pickup, rider_accepted_at: null }), false);
});

test('COD never exposes rider payment QR at any stage', () => {
  for (const status of ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled']) {
    assert.equal(canShowSellerRiderQr({ ...pickup, status, payment_method: 'cod' }), false);
  }
});

test('NON-COD QR is hidden after departure and outside pickup', () => {
  for (const status of ['pending', 'accepted', 'preparing', 'picked_up', 'delivered', 'cancelled']) {
    assert.equal(canShowSellerRiderQr({ ...pickup, status }), false);
  }
  assert.equal(canShowSellerRiderQr({ ...pickup, rider_id: null }), false);
});