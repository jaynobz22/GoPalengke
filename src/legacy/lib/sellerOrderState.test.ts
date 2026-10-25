import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReviewNewSellerOrder } from './sellerOrderState';

test('a cached pending order cannot offer accept or decline before refresh', () => {
  assert.equal(canReviewNewSellerOrder({ status: 'pending' }, false), false);
  assert.equal(canReviewNewSellerOrder({ status: 'pending' }, true), true);
});

test('delivered, cancelled and seller-DONE orders never offer accept or decline', () => {
  assert.equal(canReviewNewSellerOrder({ status: 'delivered' }, true), false);
  assert.equal(canReviewNewSellerOrder({ status: 'cancelled' }, true), false);
  assert.equal(canReviewNewSellerOrder({ status: 'pending', seller_done_at: '2026-10-25T01:59:00Z' }, true), false);
});