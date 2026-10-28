import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codRemitToSeller, riderFeeFor, buyerPaysCod } from './codRemit';
import { EXTRA_PICKUP_FEE } from './multiStoreRider';

test('rider deducts delivery fee before sending to seller', () => {
  assert.equal(codRemitToSeller({ total: 500, delivery_fee: 49 }), 500);
});

test('seller-funded free delivery subsidy is also kept by rider', () => {
  const o = { total: 600, delivery_fee: 0, seller_delivery_subsidy: 49 };
  assert.equal(riderFeeFor(o), 49);
  assert.equal(codRemitToSeller(o), 551);
});

test('COD extra-store pickup fee is collected from buyer and kept by rider', () => {
  const o = { total: 200, delivery_fee: EXTRA_PICKUP_FEE };
  assert.equal(EXTRA_PICKUP_FEE, 10);
  assert.equal(buyerPaysCod(o), 210);
  assert.equal(riderFeeFor(o), 10);
  assert.equal(codRemitToSeller(o), 200);
});
