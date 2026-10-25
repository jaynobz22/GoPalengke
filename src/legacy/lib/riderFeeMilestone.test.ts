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
test('first paid cycle is 300 onboarding plus 200 platform and subsequent cycles need 500 platform', () => {
  assert.equal(riderPaidMilestones(200), 0);
  assert.equal(riderPaidMilestones(499.99), 0);
  assert.equal(riderPaidMilestones(500), 1);
  assert.equal(riderPaidMilestones(1000), 2);
  assert.equal(riderPaidMilestones(199.99, 300), 0);
  assert.equal(riderPaidMilestones(200, 300), 1);
  assert.equal(riderPaidMilestones(699.99, 300), 1);
  assert.equal(riderPaidMilestones(700, 300), 2);
  assert.equal(riderPaidMilestones(0, 300), 0);
  assert.equal(riderPaidMilestones(200, 600), 1);
});
test('active onboarding contributes to first 500 progress; paid onboarding never recurs', () => {
  assert.deepEqual(riderFeeProgress(200, 'active'), { current: 500, remaining: 0, percent: 100 });
  assert.equal(riderFeeProgress(199.99, 'active').remaining, 0.01);
  assert.equal(riderFeeProgress(100, 'active').percent, 80);
  assert.equal(riderFeeProgress(150, 'active').percent, 90);
  assert.equal(riderFeeProgress(0, 'paid').current, 0);
  assert.equal(riderFeeProgress(200, 'paid').remaining, 300);
  assert.equal(riderFeeProgress(500, 'paid').percent, 100);
  assert.equal(riderFeeProgress(30, 'pending').current, 30);
  assert.equal(riderFeeProgress(200, 'active', 100).current, 400);
});
test('rider affiliate share is 35 direct plus 15 upline', () => {
  assert.deepEqual(riderAffiliateSplit(true), { direct: 35, upline: 15 });
});
test('without sponsor the direct affiliate receives all 50', () => {
  assert.deepEqual(riderAffiliateSplit(false), { direct: 50, upline: 0 });
});