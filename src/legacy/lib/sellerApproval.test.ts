import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { approveSellerAccount, completeSellerApproval } from './sellerApproval';

function fixture(options: { storageError?: boolean; insertError?: boolean; profileError?: boolean; role?: string } = {}) {
  const messages = [
    { id: 'request', sender_id: 'admin', body: 'Mabuhay! Welcome to GoPalengke! 🛒\nRequirements', image_url: null, is_verification_image: false },
    { id: 'id-photo', sender_id: 'seller', body: null, image_url: 'https://example.org/storage/v1/object/public/chat-images/seller/id.jpg', is_verification_image: true },
    { id: 'ordinary', sender_id: 'seller', body: 'Product inquiry', image_url: 'https://example.org/storage/v1/object/public/chat-images/seller/product.jpg', is_verification_image: false },
    { id: 'text', sender_id: 'admin', body: 'Salamat sa update', image_url: null, is_verification_image: false },
  ];
  const events: { table: string; action: string; values?: any }[] = [];
  const removed: string[] = [];
  let failInsert = options.insertError;
  const client = {
    from(table: string) {
      let action = 'select';
      let values: any;
      let ids: string[] = [];
      const query: any = {
        select() { return query; }, eq() { return query; }, order() { return query; }, single() { return query; },
        in(_field: string, selected: string[]) { ids = selected; return query; },
        update(input: any) { action = 'update'; values = input; return query; },
        insert(input: any) { action = 'insert'; values = input; return query; },
        delete() { action = 'delete'; return query; },
        then(resolve: any, reject: any) {
          events.push({ table, action, values });
          let error = null;
          let data: any = null;
          if (table === 'profiles' && action === 'select') data = { id: 'seller', role: options.role || 'seller' };
          if (table === 'profiles' && action === 'update' && options.profileError) error = { message: 'Profile denied' };
          if (table === 'admin_conversations' && action === 'select') data = [{ id: 'conversation', admin_id: 'admin' }];
          if (table === 'admin_messages' && action === 'select') data = messages.map(m => ({ ...m }));
          if (table === 'admin_messages' && action === 'delete') {
            for (let i = messages.length - 1; i >= 0; i--) if (ids.includes(messages[i].id)) messages.splice(i, 1);
          }
          if (table === 'admin_messages' && action === 'insert') {
            if (failInsert) { error = { message: 'Insert denied' }; failInsert = false; }
            else messages.push({ id: 'congrats', image_url: null, is_verification_image: false, ...values });
          }
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from() { return { async remove(paths: string[]) {
      events.push({ table: 'storage', action: 'delete' });
      if (options.storageError) return { error: { message: 'Storage denied' } };
      removed.push(...paths); return { error: null };
    } }; } },
  } as unknown as SupabaseClient;
  return { client, messages, removed, events };
}

test('seller approval verifies account and store before completing chat', async () => {
  const f = fixture();
  await approveSellerAccount(f.client, 'seller', 'admin');
  assert.deepEqual(f.events.filter(e => e.action === 'update').slice(0, 2), [
    { table: 'stores', action: 'update', values: { is_verified: true } },
    { table: 'profiles', action: 'update', values: { is_approved: true } },
  ]);
});

test('completion deletes only verification request and submitted verification documents', async () => {
  const f = fixture();
  await completeSellerApproval(f.client, 'seller', 'admin');
  assert.deepEqual(f.removed, ['seller/id.jpg']);
  assert.deepEqual(f.messages.map(m => m.id), ['ordinary', 'text', 'congrats']);
});

test('storage failure preserves document references and prevents a false completion message', async () => {
  const f = fixture({ storageError: true });
  await assert.rejects(completeSellerApproval(f.client, 'seller', 'admin'), /Storage denied/);
  assert.deepEqual(f.messages.map(m => m.id), ['request', 'id-photo', 'ordinary', 'text']);
});

test('approval failure never deletes documents or sends congratulations', async () => {
  const f = fixture({ profileError: true });
  await assert.rejects(approveSellerAccount(f.client, 'seller', 'admin'), /Profile denied/);
  assert.equal(f.removed.length, 0);
  assert.equal(f.events.some(e => e.table === 'admin_messages'), false);
});

test('retry after message failure completes without deleting unrelated chat or duplicating approval', async () => {
  const f = fixture({ insertError: true });
  await assert.rejects(completeSellerApproval(f.client, 'seller', 'admin'), /Insert denied/);
  await completeSellerApproval(f.client, 'seller', 'admin');
  await completeSellerApproval(f.client, 'seller', 'admin');
  assert.equal(f.messages.filter(m => m.id === 'congrats').length, 1);
  assert.deepEqual(f.removed, ['seller/id.jpg']);
  assert.equal(f.messages.some(m => m.id === 'ordinary'), true);
});