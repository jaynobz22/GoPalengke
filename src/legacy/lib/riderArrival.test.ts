import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMarkRiderArrival, canMarkRiderDelivered } from './riderArrival';

const travelling = { status: 'picked_up', payment_method: 'cod', rider_arrived_buyer_at: null as string | null, cod_payment_reference: null as string | null };
test('arrival is available only during travel and cannot be repeated', () => {
  assert.equal(canMarkRiderArrival(travelling), true);
  assert.equal(canMarkRiderArrival({ ...travelling, status: 'ready_for_pickup' }), false);
  assert.equal(canMarkRiderArrival({ ...travelling, rider_arrived_buyer_at: '2026-10-24T23:11:00Z' }), false);
});
test('NON-COD delivery needs explicit arrival first', () => {
  assert.equal(canMarkRiderDelivered([{ ...travelling, payment_method: 'qr_code' }]), false);
  assert.equal(canMarkRiderDelivered([{ ...travelling, payment_method: 'qr_code', rider_arrived_buyer_at: '2026-10-24T23:11:00Z' }]), true);
});
test('COD delivery waits for remittance after arrival', () => {
  const arrived = { ...travelling, rider_arrived_buyer_at: '2026-10-24T23:11:00Z' };
  assert.equal(canMarkRiderDelivered([arrived]), false);
  assert.equal(canMarkRiderDelivered([{ ...arrived, cod_payment_reference: '  ' }]), false);
  assert.equal(canMarkRiderDelivered([{ ...arrived, cod_payment_reference: 'REF-123' }]), true);
});
test('every store in a group must have arrival and COD remittance', () => {
  const ready = { ...travelling, rider_arrived_buyer_at: '2026-10-24T23:11:00Z', cod_payment_reference: 'REF-1' };
  assert.equal(canMarkRiderDelivered([ready, { ...ready, cod_payment_reference: null }]), false);
  assert.equal(canMarkRiderDelivered([ready, { ...ready, cod_payment_reference: 'REF-2' }]), true);
  assert.equal(canMarkRiderDelivered([{ ...ready, status: 'cancelled' }]), false);
  assert.equal(canMarkRiderDelivered([]), false);
});