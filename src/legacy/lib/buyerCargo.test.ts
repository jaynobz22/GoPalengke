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
