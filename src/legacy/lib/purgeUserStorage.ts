// @ts-nocheck
import { supabase } from './supabase';

const URL_RE = /\/storage\/v1\/object\/public\/([^/"'\s]+)\/([^"'\s?]+)/g;

function collect(rows: any, out: Map<string, Set<string>>) {
  if (!rows) return;
  const text = JSON.stringify(rows);
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const bucket = m[1];
    const path = decodeURIComponent(m[2].replace(/\\$/, ''));
    if (!out.has(bucket)) out.set(bucket, new Set());
    out.get(bucket)!.add(path);
  }
}

async function q(table: string, col: string, vals: string[]) {
  if (!vals.length) return [];
  try {
    const { data } = await supabase.from(table).select('*').in(col, vals);
    return data || [];
  } catch {
    return [];
  }
}

/** Removes every uploaded file referenced by a user's records (profile, store, products, chats, orders, affiliate). */
export async function purgeUserStorage(userId: string): Promise<number> {
  const out = new Map<string, Set<string>>();
  const ids = [userId];

  collect(await q('profiles', 'id', ids), out);
  const stores = await q('stores', 'seller_id', ids);
  collect(stores, out);
  const storeIds = stores.map((s: any) => s.id);
  collect(await q('products', 'store_id', storeIds), out);
  collect(await q('messages', 'sender_id', ids), out);
  collect(await q('admin_messages', 'sender_id', ids), out);
  collect(await q('orders', 'buyer_id', ids), out);
  collect(await q('orders', 'rider_id', ids), out);
  collect(await q('orders', 'store_id', storeIds), out);
  collect(await q('fee_payments', 'seller_id', ids), out);
  collect(await q('rider_fee_payments', 'rider_id', ids), out);
  collect(await q('video_credit_purchases', 'user_id', ids), out);
  collect(await q('reviews', 'reviewer_id', ids), out);
  const affs = await q('affiliates', 'user_id', ids);
  collect(affs, out);

  // Also sweep any folder named after the user id in known buckets.
  for (const bucket of ['profile-images', 'store-images', 'product-images', 'chat-images', 'payment-proofs', 'avatars', 'documents']) {
    try {
      const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
      (data || []).forEach((f: any) => {
        if (!out.has(bucket)) out.set(bucket, new Set());
        out.get(bucket)!.add(`${userId}/${f.name}`);
      });
    } catch { /* bucket may not exist */ }
  }

  let removed = 0;
  for (const [bucket, paths] of out) {
    const list = [...paths];
    for (let i = 0; i < list.length; i += 100) {
      try {
        const { data } = await supabase.storage.from(bucket).remove(list.slice(i, i + 100));
        removed += data?.length || 0;
      } catch { /* ignore */ }
    }
  }
  return removed;
}
