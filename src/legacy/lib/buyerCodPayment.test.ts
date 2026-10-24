import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BUYER_COD_PAYMENT, canShowBuyerCodPayment } from './buyerCodPayment';
test('buyer COD payment defaults to QR', () => {
  assert.equal(DEFAULT_BUYER_COD_PAYMENT, 'qr');
});
test('rider payment choices appear only after arrival on COD', () => {
  const arrived = { status: 'picked_up', payment_method: 'cod', rider_id: 'rider-1', rider_arrived_buyer_at: '2026-10-24T23:29:00Z' };
  assert.equal(canShowBuyerCodPayment(arrived), true);
  assert.equal(canShowBuyerCodPayment({ ...arrived, rider_arrived_buyer_at: null }), false);
  assert.equal(canShowBuyerCodPayment({ ...arrived, payment_method: 'qr_code' }), false);
  assert.equal(canShowBuyerCodPayment({ ...arrived, status: 'delivered' }), false);
  assert.equal(canShowBuyerCodPayment({ ...arrived, rider_id: null }), false);
});