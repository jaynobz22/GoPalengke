// @ts-nocheck
import { supabase } from './supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

function pathOf(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/chat-images\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function removeRows(table: 'messages' | 'admin_messages', rows: { id: string; image_url: string | null }[]) {
  if (!rows.length) return 0;
  const paths = rows.map(r => pathOf(r.image_url)).filter(Boolean) as string[];
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from('chat-images').remove(paths.slice(i, i + 100));
  }
  const ids = rows.map(r => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    await supabase.from(table).delete().in('id', ids.slice(i, i + 100));
  }
  return rows.length;
}

/**
 * Binubura ang mga ordinaryong larawan sa chat na lampas 24 oras na.
 * Ang verification images (ID, selfie, tindahan, permit) ay HINDI ginagalaw dito —
 * mabubura lang ang mga iyon kapag na-approve na ng admin ang seller.
 */
export async function cleanupExpiredChatImages(): Promise<number> {
  const cutoff = new Date(Date.now() - DAY_MS).toISOString();
  let removed = 0;
  try {
    const { data } = await supabase
      .from('messages')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .lt('created_at', cutoff)
      .limit(500);
    removed += await removeRows('messages', data || []);
  } catch { /* best-effort */ }
  try {
    const { data } = await supabase
      .from('admin_messages')
      .select('id, image_url, is_verification_image')
      .not('image_url', 'is', null)
      .lt('created_at', cutoff)
      .limit(500);
    const ordinary = (data || []).filter((m: any) => !m.is_verification_image);
    removed += await removeRows('admin_messages', ordinary);
  } catch { /* best-effort */ }
  return removed;
}

/** Binubura ang lahat ng verification images ng isang user (tawagin pagka-approve ng admin). */
export async function purgeVerificationImages(userId: string): Promise<number> {
  try {
    const { data: convs } = await supabase.from('admin_conversations').select('id').eq('user_id', userId);
    const ids = (convs || []).map((c: any) => c.id);
    if (!ids.length) return 0;
    const { data } = await supabase
      .from('admin_messages')
      .select('id, image_url')
      .in('conversation_id', ids)
      .eq('sender_id', userId)
      .not('image_url', 'is', null);
    return await removeRows('admin_messages', data || []);
  } catch {
    return 0;
  }
}
