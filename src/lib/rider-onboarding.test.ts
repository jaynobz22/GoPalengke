import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { needsProfileCompletion } from '../legacy/lib/profileCompletion';
import { sendRiderApprovalReminder } from './rider-onboarding.server';

const completeRider = {
  role: 'rider', full_name: 'Test Rider', avatar_url: 'avatar', vehicle_type: 'motorcycle',
  rider_age: 25, rider_family_status: 'Single', rider_residence_address: '123 Test Street',
  rider_plate_number: 'ABC 123', rider_motor_model: 'Honda', rider_valid_id_url: 'license',
  rider_lto_or_cr_url: 'orcr', rider_qr_code_url: 'qr', city: 'Davao', barangay: 'Test',
};

test('a rider with all required submitted details can enter the dashboard', () => {
  assert.equal(needsProfileCompletion(completeRider), false);
});

test('incomplete rider details still prevent dashboard access', () => {
  assert.equal(needsProfileCompletion({ ...completeRider, rider_valid_id_url: '' }), true);
});

test('a rider without an uploaded QR code still needs profile completion', () => {
  assert.equal(needsProfileCompletion({ ...completeRider, rider_qr_code_url: '' }), true);
});

test('concurrent reminder loads and retries create only one admin message', async () => {
  const messages = new Map<string, any>();
  const client = { from(table: string) {
    assert.equal(table, 'admin_messages');
    return { async upsert(row: any, options: any) {
      assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true });
      if (!messages.has(row.id)) messages.set(row.id, row);
      return { error: null };
    } };
  } } as unknown as SupabaseClient;
  const conversation = { id: 'rider-chat', admin_id: 'assigned-admin' };
  await Promise.all([sendRiderApprovalReminder(client, conversation), sendRiderApprovalReminder(client, conversation)]);
  await sendRiderApprovalReminder(client, conversation);
  assert.equal(messages.size, 1);
  assert.equal([...messages.values()][0].sender_id, 'assigned-admin');
});

test('failed reminder writes are not reported as sent', async () => {
  const client = { from() { return { async upsert() { return { error: { message: 'denied' } }; } }; } } as unknown as SupabaseClient;
  await assert.rejects(sendRiderApprovalReminder(client, { id: 'chat', admin_id: 'admin' }));
});