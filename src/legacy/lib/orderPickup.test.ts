import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickupUpdate } from './orderPickup';
import { canShowBuyerRiderTracking } from './buyerRiderTracking';

test('single-store pickup from either seller or rider activates buyer delivery tracking', () => {
  const now = '2026-10-24T22:58:00Z';
  for (const payment_method of ['cod', 'qr_code']) {
    const update = pickupUpdate(null, now);
    assert.deepEqual(update, { status: 'picked_up', picked_up_at: now });
    const order = { rider_id: 'rider-1', rider_accepted_at: '2026-10-24T22:51:00Z', payment_method, ...update };
    assert.equal(order.status, 'picked_up');
    assert.equal(canShowBuyerRiderTracking(order), true);
  }
});

test('a group ID with only one order still activates delivery on pickup', () => {
  assert.deepEqual(pickupUpdate('group-1', '2026-10-24T22:58:00Z', 1), { status: 'picked_up', picked_up_at: '2026-10-24T22:58:00Z' });
  assert.deepEqual(pickupUpdate('group-1', '2026-10-24T22:58:00Z', 2), { picked_up_at: '2026-10-24T22:58:00Z' });
});

test('one store pickup does not prematurely depart a multi-store delivery', () => {
  const update = pickupUpdate('group-1', '2026-10-24T22:58:00Z');
  assert.deepEqual(update, { picked_up_at: '2026-10-24T22:58:00Z' });
  assert.equal({ status: 'ready_for_pickup', ...update }.status, 'ready_for_pickup');
});