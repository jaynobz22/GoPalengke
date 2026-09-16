const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function ogPreviewUrl(path: string): string {
  return `${SUPABASE_URL}/functions/v1/og-preview${path}`;
}
