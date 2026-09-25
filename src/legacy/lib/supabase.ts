// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

// GoPalengke connects to the owner's existing Supabase project (melwjygaczevpasgazfo).
// The anon key is a publishable/public key — safe to ship in client code.
const supabaseUrl =
  import.meta.env.VITE_GOPALENGKE_SUPABASE_URL || 'https://melwjygaczevpasgazfo.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_GOPALENGKE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHdqeWdhY3pldnBhc2dhemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTQ1MjcsImV4cCI6MjEwNDA3MDUyN30.tsqdbMBiCc5uJvd3eyk54S51TN1ZxoYusQOwwKWooq0';

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export async function deleteStorageObject(bucket: string, publicUrl: string): Promise<void> {
  const path = extractStoragePath(publicUrl, bucket);
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
