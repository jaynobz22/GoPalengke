import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authLocation, isAuthLocation } from './authNavigation';
import { readAccountProfile } from './accountProfile';
import type { SupabaseClient } from '@supabase/supabase-js';

test('opening login creates a URL distinguishable from homepage', () => {
  assert.equal(authLocation('https://example.org/', true), '/?auth=1');
  assert.equal(isAuthLocation('?auth=1'), true);
  assert.equal(isAuthLocation(''), false);
});

test('leaving targeted signup returns homepage without reopening signup', () => {
  assert.equal(authLocation('https://example.org/?signup=rider&ref=ABC&auth=1', false), '/?ref=ABC');
  assert.equal(isAuthLocation('?signup=rider'), true);
});

function profileClient(data: unknown, error: unknown) {
  const signOuts: unknown[] = [];
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data, error }) };
  const client = {
    from: () => query,
    auth: { signOut: async (options: unknown) => { signOuts.push(options); return { error: null }; } },
  } as unknown as SupabaseClient;
  return { client, signOuts };
}

test('a successfully confirmed missing profile clears only the local session', async () => {
  const { client, signOuts } = profileClient(null, null);
  await readAccountProfile(client, 'deleted-user');
  assert.deepEqual(signOuts, [{ scope: 'local' }]);
});

test('profile read failures never sign out existing accounts', async () => {
  const { client, signOuts } = profileClient(null, { message: 'Network error' });
  await readAccountProfile(client, 'existing-user');
  assert.equal(signOuts.length, 0);
});

test('existing incomplete profiles retain their session', async () => {
  const { client, signOuts } = profileClient({ id: 'existing-user', full_name: '' }, null);
  const result = await readAccountProfile(client, 'existing-user');
  assert.deepEqual(result.data, { id: 'existing-user', full_name: '' });
  assert.equal(signOuts.length, 0);
});