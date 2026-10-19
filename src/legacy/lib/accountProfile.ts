import type { SupabaseClient } from '@supabase/supabase-js';

// A failed read is not evidence that an account was deleted.
export async function readAccountProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!error && !data) await client.auth.signOut({ scope: 'local' });
  return { data, error };
}