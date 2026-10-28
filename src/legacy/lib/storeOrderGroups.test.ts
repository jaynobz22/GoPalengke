import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupStoreOrders, selectedStoreOrder, canShowStorePayment } from './storeOrderGroups';

const orders = Array.from({ length: 4 }, (_, i) => ({ id: `order-${i + 1}`, store_id: `store-${i + 1}`, buyer_id: 'buyer-1', delivery_group_id: 'checkout-1', total: (i + 1) * 150 }));

test('four purchased stores stay in one buyer checkout with independent order amounts', () => {
  const groups = groupStoreOrders(orders);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.orders.map(o => o.store_id), ['store-1', 'store-2', 'store-3', 'store-4']);
  assert.equal(selectedStoreOrder(groups[0]?.orders || [], 'order-3')?.total, 450);
});
test('different checkouts and buyers never share store tabs', () => {
  const first = orders[0];
  assert.ok(first);
  assert.equal(groupStoreOrders([...orders, { ...first, id: 'other-checkout', delivery_group_id: 'checkout-2' }, { ...first, id: 'other-buyer', buyer_id: 'buyer-2' }]).length, 3);
});
test('single-store orders without a batch remain separate', () => {
  assert.equal(groupStoreOrders(orders.map(o => ({ ...o, delivery_group_id: null }))).length, 4);
});
test('removing the selected order falls back to a remaining store', () => {
  assert.equal(selectedStoreOrder(orders.slice(1), 'order-1')?.id, 'order-2');
  assert.equal(selectedStoreOrder([], 'order-1'), undefined);
});
test('seller QR stays hidden until that particular store confirms', () => {
  const pending = { status: 'pending', payment_method: 'qr_code', payment_status: 'unpaid' };
  assert.equal(canShowStorePayment(pending), false);
  assert.equal(canShowStorePayment({ ...pending, status: 'accepted' }), true);
  assert.equal(canShowStorePayment(pending), false);
  assert.equal(canShowStorePayment({ ...pending, status: 'cancelled' }), false);
  assert.equal(canShowStorePayment({ ...pending, status: 'accepted', payment_method: 'cod' }), false);
  assert.equal(canShowStorePayment({ ...pending, status: 'accepted', payment_status: 'paid' }), false);
});