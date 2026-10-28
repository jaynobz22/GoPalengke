import { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STORE_TRIP_PREFIX } from '../lib/multiStorePickup';

export function BuyerStoreTripNotice({ groupId, buyerId, riderId, status }: {
  groupId: string; buyerId: string; riderId: string; status: string;
}) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (status !== 'ready_for_pickup') { setNotice(''); return; }
    let stopped = false;
    async function load() {
      const { data: orders, error } = await supabase.from('orders').select('id')
        .eq('delivery_group_id', groupId).eq('buyer_id', buyerId).eq('rider_id', riderId);
      if (error || !orders?.length || stopped) return;
      const { data: chats } = await supabase.from('conversations').select('id')
        .in('order_id', orders.map(o => o.id)).eq('type', 'buyer_rider').eq('rider_id', riderId);
      if (!chats?.length || stopped) return;
      const { data: messages } = await supabase.from('messages').select('body, created_at')
        .in('conversation_id', chats.map(c => c.id)).eq('sender_id', riderId)
        .like('body', `${STORE_TRIP_PREFIX}%`).order('created_at', { ascending: false }).limit(1);
      if (!stopped) setNotice(messages?.[0]?.body || '');
    }
    void load();
    const timer = setInterval(load, 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [groupId, buyerId, riderId, status]);
  if (!notice || status !== 'ready_for_pickup') return null;
  return <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-accent p-3 text-accent-foreground">
    <Navigation size={18} className="shrink-0" /><p className="text-sm font-semibold">{notice}</p>
  </div>;
}