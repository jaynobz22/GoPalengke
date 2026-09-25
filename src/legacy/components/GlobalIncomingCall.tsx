// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { VideoCall } from './VideoCall';
import { useRingtone } from './ChatView';

// Nagri-ring ang video call kahit wala sa mismong chat ang tinatawagan
// (dati, lumalabas lang ang tawag kung bukas ang parehong chat — kaya "ayaw mag-connect").
export function GlobalIncomingCall() {
  const { profile } = useAuth();
  const [incoming, setIncoming] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const handled = useRef<Set<string>>(new Set());
  const { start, stop } = useRingtone();

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    const check = async () => {
      if (cancelled || active) return;
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, call_room_id, call_status, created_at')
        .eq('message_type', 'video_call')
        .eq('call_status', 'pending')
        .neq('sender_id', profile.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const msg = data?.[0];
      const openConv = (window as any).__gpOpenChatConv;
      if (msg && !handled.current.has(msg.id) && msg.conversation_id !== openConv) {
        if (!incoming || incoming.id !== msg.id) {
          const { data: p } = await supabase.from('profiles').select('full_name, store_name').eq('id', msg.sender_id).maybeSingle();
          if (!cancelled) setIncoming({ ...msg, name: p?.store_name || p?.full_name || 'Tumatawag' });
        }
      } else if (!msg || msg.conversation_id === openConv) {
        setIncoming(null);
      }
    };
    check();
    const t = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [profile?.id, active, incoming?.id]);

  useEffect(() => {
    if (incoming && !active) start(); else stop();
    return () => stop();
  }, [incoming?.id, active]);

  const setStatus = (id: string, status: string) =>
    supabase.from('messages').update({ call_status: status }).eq('id', id);

  async function accept() {
    const msg = incoming;
    handled.current.add(msg.id);
    stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      s.getTracks().forEach(t => t.stop());
    } catch {}
    setIncoming(null);
    setActive(msg);
    setStatus(msg.id, 'accepted');
  }

  async function decline() {
    handled.current.add(incoming.id);
    stop();
    await setStatus(incoming.id, 'declined');
    setIncoming(null);
  }

  if (active) {
    return (
      <VideoCall
        roomId={active.call_room_id}
        isCaller={false}
        otherName={active.name}
        onEnd={() => { setStatus(active.id, 'ended'); setActive(null); }}
      />
    );
  }

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900/95 px-6 text-center" style={{ zIndex: 998 }}>
      <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center mb-5 animate-pulse">
        <Video size={44} className="text-white" />
      </div>
      <p className="text-white text-xl font-bold mb-1">{incoming.name}</p>
      <p className="text-gray-300 text-sm">Tumatawag sa iyo (video call)</p>
      <div className="mt-10 flex gap-10">
        <button onClick={decline} className="flex flex-col items-center gap-2 active:scale-95">
          <span className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"><PhoneOff size={28} className="text-white" /></span>
          <span className="text-red-300 text-xs">Tanggihan</span>
        </button>
        <button onClick={accept} className="flex flex-col items-center gap-2 active:scale-95">
          <span className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"><Phone size={28} className="text-white" /></span>
          <span className="text-green-300 text-xs">Sagutin</span>
        </button>
      </div>
    </div>
  );
}
