import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codRemitToSeller, riderFeeFor } from './codRemit';

test('rider deducts delivery fee before sending to seller', () => {
  assert.equal(codRemitToSeller({ total: 500, delivery_fee: 49 }), 500);
});

test('seller-funded free delivery subsidy is also kept by rider', () => {
  const o = { total: 600, delivery_fee: 0, seller_delivery_subsidy: 49 };
  assert.equal(riderFeeFor(o), 49);
  assert.equal(codRemitToSeller(o), 551);
});
