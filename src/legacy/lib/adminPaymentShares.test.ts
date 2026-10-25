import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentAffiliateShares } from './adminPaymentShares';
test('admin deducts 50 rider affiliate share and 200 seller share from separate payments', () => {
  const result = paymentAffiliateShares([
    { description: '[rfp:abc-123]', amount: 35, status: 'credited' },
    { description: '[rfp:abc-123]', amount: 15, status: 'credited' },
    { description: '[fp:abc-123]', amount: 200, status: 'credited' },
    { description: '[rfp:abc-123]', amount: 50, status: 'pending' },
  ]);
  assert.equal(500 - result['rfp:abc-123'], 450);
  assert.equal(1000 - result['fp:abc-123'], 800);
});