import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShowBuyerRiderTracking, mergeBuyerOrderUpdate, interpolateRiderPosition } from './buyerRiderTracking';

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

test('backup refresh updates moving GPS even when delivery status is unchanged', () => {
  const before = { status: 'picked_up', rider_lat: 7.1, rider_lng: 125.6 };
  const updated = mergeBuyerOrderUpdate(before, { ...before, rider_lat: 7.2, rider_lng: 125.7 });
  assert.equal(updated.rider_lat, 7.2);
  assert.equal(updated.rider_lng, 125.7);
  assert.notEqual(updated, before);
  assert.equal(mergeBuyerOrderUpdate(updated, { ...updated }), updated);
});

test('backup refresh includes seller completion and payment confirmation', () => {
  const updated = mergeBuyerOrderUpdate({ status: 'delivered', seller_done_at: null as string | null, cod_payment_accepted_at: null as string | null },
    { seller_done_at: '2026-10-24T23:00:00Z', cod_payment_accepted_at: '2026-10-24T22:59:00Z' });
  assert.equal(updated.seller_done_at, '2026-10-24T23:00:00Z');
  assert.equal(updated.cod_payment_accepted_at, '2026-10-24T22:59:00Z');
});

test('marker interpolation reaches the actual GPS point and never overshoots', () => {
  const from = { lat: 7, lng: 125 };
  const to = { lat: 8, lng: 126 };
  assert.deepEqual(interpolateRiderPosition(from, to, 0), from);
  assert.deepEqual(interpolateRiderPosition(from, to, 0.5), { lat: 7.5, lng: 125.5 });
  assert.deepEqual(interpolateRiderPosition(from, to, 2), to);
});