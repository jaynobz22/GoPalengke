// @ts-nocheck
import { SUPABASE_URL } from './supabase';

export function ogPreviewUrl(path: string): string {
  return `${SUPABASE_URL}/functions/v1/og-preview${path}`;
}
