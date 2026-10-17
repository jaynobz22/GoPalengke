import { supabase } from './supabase';
import { sendOrderSms } from '../../lib/order-sms.functions';

/** Fire-and-forget SMS notification; never blocks or breaks the order flow. */
export function notifyOrderSms(orderId: string | undefined | null, event: 'new_order' | 'rider_assigned' | 'on_the_way') {
  if (!orderId) return;
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await sendOrderSms({ data: { token, orderId, event } });
    } catch { /* ignore */ }
  })();
}
