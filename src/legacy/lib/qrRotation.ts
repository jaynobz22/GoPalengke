// @ts-nocheck
import { supabase } from './supabase';

// Video credit purchases always pay to this QR (UnionBank by default).
export const VIDEO_CREDIT_QR_KEY = 'VIDEO_CREDIT_QR_ID';
// Seller/Rider billing QRs rotate through this pool once the daily limit is hit.
export const ROTATION_DAILY_LIMIT = 50000;
const ROTATION_ORDER = ['gotyme', 'ownbank', 'maribank'];

type Qr = { id: string; label: string; image_url: string; is_active: boolean; created_at: string };

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

export async function getVideoCreditQr(): Promise<Qr | null> {
  const [{ data: setting }, { data: qrs }] = await Promise.all([
    supabase.from('platform_settings').select('value').eq('key', VIDEO_CREDIT_QR_KEY).maybeSingle(),
    supabase.from('platform_qr_codes').select('*'),
  ]);
  const list = (qrs || []) as Qr[];
  return (
    list.find(q => q.id === setting?.value) ||
    list.find(q => norm(q.label).includes('union')) ||
    list.find(q => q.is_active) ||
    null
  );
}

/** Pool of QRs used for seller & rider fee payments, in rotation order. */
export function getRotationPool(qrs: Qr[], videoQrId?: string | null): Qr[] {
  const pool = qrs.filter(q => q.id !== videoQrId && !norm(q.label).includes('union'));
  const rank = (q: Qr) => {
    const i = ROTATION_ORDER.findIndex(k => norm(q.label).includes(k));
    return i === -1 ? 99 : i;
  };
  return pool.sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at));
}

/** Start of today in Philippine time, as ISO. */
function startOfTodayManila(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 3600_000);
  manila.setUTCHours(0, 0, 0, 0);
  return new Date(manila.getTime() - 8 * 3600_000).toISOString();
}

/** Admin-only: totals today's received fee payments and activates the right pool QR. */
export async function rotateBillingQr(): Promise<{ total: number; current: Qr | null; pool: Qr[] }> {
  const since = startOfTodayManila();
  const [{ data: qrs }, { data: setting }, { data: fees }, { data: riderFees }] = await Promise.all([
    supabase.from('platform_qr_codes').select('*'),
    supabase.from('platform_settings').select('value').eq('key', VIDEO_CREDIT_QR_KEY).maybeSingle(),
    supabase.from('fee_payments').select('amount, status').gte('created_at', since),
    supabase.from('rider_fee_payments').select('amount, status').gte('created_at', since),
  ]);
  const videoQr = (qrs || []).find(q => q.id === setting?.value) || (qrs || []).find(q => norm(q.label).includes('union'));
  const pool = getRotationPool((qrs || []) as Qr[], videoQr?.id);
  const total = [...(fees || []), ...(riderFees || [])]
    .filter(p => p.status !== 'rejected')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  if (pool.length === 0) return { total, current: null, pool };
  const current = pool[Math.floor(total / ROTATION_DAILY_LIMIT) % pool.length];
  if (!current.is_active) {
    await supabase.from('platform_qr_codes').update({ is_active: false }).eq('is_active', true);
    await supabase.from('platform_qr_codes').update({ is_active: true }).eq('id', current.id);
  }
  return { total, current, pool };
}
