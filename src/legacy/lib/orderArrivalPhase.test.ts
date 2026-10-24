import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderArrivalPhase } from './orderArrivalPhase';

test('pickup is travelling until the rider records buyer arrival', () => {
  assert.equal(orderArrivalPhase({ status: 'picked_up' }), 'travelling');
  assert.equal(orderArrivalPhase({ status: 'picked_up', rider_arrived_buyer_at: '2026-10-24T23:34:00Z' }), 'arrived');
});

test('arrival remains separate from delivered and cannot activate before departure', () => {
  const arrival = { rider_arrived_buyer_at: '2026-10-24T23:34:00Z' };
  assert.equal(orderArrivalPhase({ ...arrival, status: 'ready_for_pickup' }), 'pending');
  assert.equal(orderArrivalPhase({ ...arrival, status: 'picked_up' }), 'arrived');
  assert.equal(orderArrivalPhase({ ...arrival, status: 'delivered' }), 'delivered');
});