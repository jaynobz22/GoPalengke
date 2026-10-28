import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStoreTrip, canDepartToBuyer, canVisitPickup, storeTripMessageId } from './multiStorePickup';

const orders = (count: number) => Array.from({ length: count }, (_, i) => ({
  id: `order-${i+1}`, store_id: `store-${i+1}`, status: 'ready_for_pickup',
  created_at: '2026-10-28', rider_accepted_at: 'accepted', picked_up_at: null as string | null,
}));

for (const count of [2, 3, 4]) test(`${count} stores require each pickup before buyer departure`, () => {
  const rows = orders(count);
  assert.equal(nextStoreTrip(rows), null);
  for (let i = 0; i < count; i++) {
    const row = rows[i];
    assert.ok(row);
    assert.equal(canDepartToBuyer(rows), false);
    if (i > 0) {
      assert.equal(nextStoreTrip(rows)?.order.id, `order-${i+1}`);
      assert.equal(nextStoreTrip(rows)?.ordinal, i+1);
      assert.equal(canVisitPickup(rows, row.id, new Set()), false);
      assert.equal(canVisitPickup(rows, row.id, new Set([row.id])), true);
    }
    row.picked_up_at = 'picked';
  }
  assert.equal(nextStoreTrip(rows), null);
  assert.equal(canDepartToBuyer(rows), true);
});

test('later store tabs cannot bypass preceding pickup', () => {
  const rows = orders(4);
  assert.equal(canVisitPickup(rows, 'order-3', new Set(['order-3'])), false);
  const first = rows[0]; assert.ok(first); first.picked_up_at = 'picked';
  assert.equal(nextStoreTrip([...rows].reverse())?.order.id, 'order-2');
});

test('cancelled stores do not prevent departure, empty/loading and unaccepted orders do', () => {
  const rows = orders(2); const first = rows[0]; const second = rows[1];
  assert.ok(first); assert.ok(second); first.picked_up_at = 'picked'; second.status = 'cancelled';
  assert.equal(canDepartToBuyer(rows), true);
  assert.equal(canDepartToBuyer([]), false);
  first.rider_accepted_at = '';
  assert.equal(canDepartToBuyer(rows), false);
});

test('single-store pickup does not add a next-store trip', () => {
  const rows = orders(1);
  assert.equal(canVisitPickup(rows, 'order-1', new Set()), true);
  const first = rows[0]; assert.ok(first); first.picked_up_at = 'picked';
  assert.equal(nextStoreTrip(rows), null);
  assert.equal(canDepartToBuyer(rows), true);
});

test('same rider/store departure has one persistent message id', async () => {
  const id = await storeTripMessageId('store-order-2', 'rider-1');
  assert.equal(id, await storeTripMessageId('store-order-2', 'rider-1'));
  assert.notEqual(id, await storeTripMessageId('store-order-3', 'rider-1'));
  assert.notEqual(id, await storeTripMessageId('store-order-2', 'rider-2'));
});