// @ts-nocheck
import { supabase } from './supabase';

/**
 * Realtime order watcher na may backup: realtime channel + mabilis na polling
 * (kung sakaling ma-miss ang realtime event) + agad na refresh pag bumalik sa app.
 * Returns cleanup function.
 */
export function watchOrders(name: string, filter: string | undefined, onChange: (payload?: any) => void, pollMs = 4000) {
  const topic = `${name}-${Math.random().toString(36).slice(2, 8)}`;
  const opts: any = { event: '*', schema: 'public', table: 'orders' };
  if (filter) opts.filter = filter;
  const ch = supabase.channel(topic).on('postgres_changes', opts, (p: any) => onChange(p)).subscribe();

  const tick = () => { if (document.visibilityState === 'visible') onChange(); };
  const iv = setInterval(tick, pollMs);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);

  return () => {
    clearInterval(iv);
    window.removeEventListener('focus', tick);
    document.removeEventListener('visibilitychange', tick);
    supabase.removeChannel(ch);
  };
}
