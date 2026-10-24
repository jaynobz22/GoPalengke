import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShowBuyerRiderTracking } from './buyerRiderTracking';

test('seller assignment alone does not activate buyer movement, even with GPS coordinates', () => {
  for (const payment_method of ['cod', 'qr_code']) {
    const order = { status: 'ready_for_pickup', rider_id: 'rider-1', rider_accepted_at: null, rider_lat: 7.1, rider_lng: 125.6, payment_method };
    assert.equal(canShowBuyerRiderTracking(order), false);
    assert.equal(canShowBuyerRiderTracking({ ...order, rider_accepted_at: '' }), false);
  }
});

test('rider acceptance activates the buyer movement notice for both payment types', () => {
  for (const payment_method of ['cod', 'qr_code']) {
    const order = { status: 'ready_for_pickup', rider_id: 'rider-1', rider_accepted_at: null as string | null, payment_method };
    assert.equal(canShowBuyerRiderTracking(order), false);
    assert.equal(canShowBuyerRiderTracking({ ...order, rider_accepted_at: '2026-10-24T22:51:00Z' }), true);
  }
});

test('picked-up deliveries keep buyer tracking available for legacy orders', () => {
  assert.equal(canShowBuyerRiderTracking({ status: 'picked_up', rider_id: 'rider-1', rider_accepted_at: null }), true);
});

test('tracking stops outside pickup/delivery and without an assigned rider', () => {
  for (const status of ['pending', 'accepted', 'preparing', 'cancelled', 'delivered']) {
    assert.equal(canShowBuyerRiderTracking({ status, rider_id: 'rider-1', rider_accepted_at: '2026-10-24T22:51:00Z' }), false);
  }
  assert.equal(canShowBuyerRiderTracking({ status: 'ready_for_pickup', rider_id: null, rider_accepted_at: '2026-10-24T22:51:00Z' }), false);
});