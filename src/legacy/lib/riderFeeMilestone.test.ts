import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riderOnboardingCharge, riderAffiliateSplit, riderPaidMilestones, riderFeeProgress, RIDER_PLATFORM_RATE } from './riderFeeMilestone';

test('one-time 300 onboarding activates at 1000 gross only while pending', () => {
  assert.equal(riderOnboardingCharge(999.99, 'pending'), 0);
  assert.equal(riderOnboardingCharge(1000, 'pending'), 300);
  assert.equal(riderOnboardingCharge(2000, 'active'), 0);
  assert.equal(riderOnboardingCharge(2000, 'paid'), 0);
});
test('3% platform fee reaches 500 independently of onboarding', () => {
  assert.equal(1000 * RIDER_PLATFORM_RATE, 30);
  assert.equal(riderFeeProgress(200).percent, 40);
  assert.equal(riderFeeProgress(500).remaining, 0);
});
test('paid platform milestones exclude onboarding and retain partial payments', () => {
  assert.equal(riderPaidMilestones(200), 0);
  assert.equal(riderPaidMilestones(499.99), 0);
  assert.equal(riderPaidMilestones(500), 1);
  assert.equal(riderPaidMilestones(1000), 2);
});
test('rider affiliate share is 35 direct plus 15 upline', () => {
  assert.deepEqual(riderAffiliateSplit(true), { direct: 35, upline: 15 });
});
test('without sponsor the direct affiliate receives all 50', () => {
  assert.deepEqual(riderAffiliateSplit(false), { direct: 50, upline: 0 });
});