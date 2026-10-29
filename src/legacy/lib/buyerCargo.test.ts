import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBuyerNote, isBuyerArranged } from './buyerCargo';
import { getRequiredTier } from './deliveryFee';

test('25 kg still fits a single motorcycle', () => {
  assert.equal(getRequiredTier(25), 'motorcycle');
});

test('over 25 kg needs a bao-bao/tricycle', () => {
  assert.equal(getRequiredTier(25.1), 'tricycle');
});

test('buyer-arranged note is detected and tells seller not to assign a rider', () => {
  const n = buildBuyerNote('ingat po', true, 'Kuya Jun');
  assert.ok(isBuyerArranged(n));
  assert.match(n!, /Huwag nang mag-assign ng rider/);
});

test('normal note is not buyer-arranged', () => {
  assert.equal(isBuyerArranged(buildBuyerNote('ingat po', false)), false);
});

import { withPickedRider, getPickedRiderId } from './buyerCargo';
test('buyer-picked bao-bao rider id is recoverable from the note', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  const n = withPickedRider('ingat po', id, 'Kuya Ben');
  assert.equal(getPickedRiderId(n), id);
  assert.match(n!, /ingat po/);
});
test('no picked rider when none chosen', () => {
  assert.equal(getPickedRiderId(withPickedRider('ingat', null)), null);
});

test('member driver note mentions agreed fee and system charge', () => {
  const n = buildBuyerNote('', true, 'Kuya Jun', true);
  assert.ok(isBuyerArranged(n));
  assert.match(n!, /registered na rider ng GoPalengke/);
});

test('outsider driver note says no system charge', () => {
  const n = buildBuyerNote('', true, 'Kuya Jun', false);
  assert.ok(isBuyerArranged(n));
  assert.match(n!, /HINDI member ng GoPalengke/);
  assert.match(n!, /walang singil ang system/);
});

import { canShowSellerQrForOutsiderCod } from './buyerCargo';
test('outsider COD shows seller QR only after driver got the cargo', () => {
  const o = { status: 'delivered', payment_method: 'cod', buyer_note: buildBuyerNote('', true, 'Kuya', false), seller_done_at: null };
  assert.equal(canShowSellerQrForOutsiderCod(o), true);
  assert.equal(canShowSellerQrForOutsiderCod({ ...o, status: 'ready_for_pickup' }), false);
  assert.equal(canShowSellerQrForOutsiderCod({ ...o, buyer_note: buildBuyerNote('', true, 'Kuya', true) }), false);
  assert.equal(canShowSellerQrForOutsiderCod({ ...o, payment_method: 'qr_code' }), false);
  assert.equal(canShowSellerQrForOutsiderCod({ ...o, seller_done_at: '2026-10-29' }), false);
});
