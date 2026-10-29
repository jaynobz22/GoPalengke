import { supabase } from './supabase';
import { getAdminAnalyticsOrders } from '../../lib/admin-analytics.functions';

let cache: { at: number; rows: any[] } | null = null;

/** All orders for admin Stats (server-verified admin); cached briefly across tabs. */
export async function loadAdminOrders(): Promise<any[]> {
  if (cache && Date.now() - cache.at < 15000) return cache.rows;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return [];
  try {
    const res = await getAdminAnalyticsOrders({ data: { token } });
    if (res.ok) { cache = { at: Date.now(), rows: res.orders }; return res.orders; }
  } catch (e) { console.error('admin analytics load failed', e); }
  return [];
}
