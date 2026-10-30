import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellerMilestoneProgress, SELLER_COMMISSION_TOTAL, SELLER_TIER1, SELLER_TIER2 } from './affiliateSellerMilestone';

test('3% accrues from the first sale, below the unrelated rent threshold', () => {
  assert.equal(sellerMilestoneProgress(1000).currentFees, 30);
  assert.equal(sellerMilestoneProgress(3350).currentFees, 100.5);
  assert.equal(sellerMilestoneProgress(3232).currentFees, 96.96);
});

test('fees accumulate toward a 1000 peso milestone', () => {
  const result = sellerMilestoneProgress(10000);
  assert.equal(result.currentFees, 300);
  assert.equal(result.remaining, 700);
  assert.equal(result.percent, 30);
  assert.equal(result.awaitingPayment, false);
});

test('an unpaid milestone stays full rather than resetting at the threshold', () => {
  assert.equal(sellerMilestoneProgress(33333).awaitingPayment, false);
  assert.equal(sellerMilestoneProgress(33333.34).currentFees, 1000);
  assert.equal(sellerMilestoneProgress(33333.34).awaitingPayment, true);
  assert.equal(sellerMilestoneProgress(40000).outstandingFees, 1200);
  assert.equal(sellerMilestoneProgress(40000).percent, 100);
});

test('a paid milestone retires 1000 pesos, retaining fees for the next cycle', () => {
  const result = sellerMilestoneProgress(40000, 1);
  assert.equal(result.currentFees, 200);
  assert.equal(result.remaining, 800);
  assert.equal(result.awaitingPayment, false);
});

test('commission is 200 pesos split 150 direct and 50 upline', () => {
  assert.equal(SELLER_COMMISSION_TOTAL, 200);
  assert.equal(SELLER_TIER1, 150);
  assert.equal(SELLER_TIER2, 50);
});
test('unpaid 700 rent counts toward the 1000 milestone like seller billing', () => {
  const r = sellerMilestoneProgress(11532.5, 0, 700);
  assert.equal(r.currentFees, 1000);
  assert.equal(r.awaitingPayment, true);
  assert.equal(sellerMilestoneProgress(2770, 0, 700).currentFees, 783.1);
});

test('Jim Tan payable retains 1045.98 above the 1000 milestone while the bar stays full', () => {
  const result = sellerMilestoneProgress(11532.67, 0, 700);
  assert.equal(result.outstandingFees, 1045.98);
  assert.equal(result.percent, 100);
  assert.equal(result.remaining, 0);
});
