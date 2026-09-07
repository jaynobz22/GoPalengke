import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Message, Conversation } from '@/lib/types';
import { ArrowLeft, Send, Video, PhoneOff, Phone } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { VideoCall } from '@/components/VideoCall';

export function useChat(conversationId: string | null) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const sub = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [conversationId]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !profile) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', profile.id)
      .is('read_at', null);
  }, [conversationId, profile]);

  useEffect(() => {
    markAsRead();
  }, [markAsRead, messages.length]);

  const sendMessage = useCallback(async (body: string) => {
    if (!conversationId || !profile || !body.trim()) return;
    setSending(true);
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: profile.id, body: body.trim() })
      .select('*')
      .single();
    if (data) {
      setMessages(prev => [...prev, data]);
    }
    setSending(false);
  }, [conversationId, profile]);

  const sendCallInvite = useCallback(async (roomId: string): Promise<Message | null> => {
    if (!conversationId || !profile) return null;
    const { data } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        body: 'Video call',
        message_type: 'video_call',
        call_room_id: roomId,
        call_status: 'pending',
      })
      .select('*')
      .single();
    if (data) {
      setMessages(prev => [...prev, data]);
    }
    return data as Message | null;
  }, [conversationId, profile]);

  const updateCallStatus = useCallback(async (messageId: string, status: string) => {
    await supabase
      .from('messages')
      .update({ call_status: status })
      .eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, call_status: status as any } : m));
  }, []);

  return { messages, loading, sending, sendMessage, sendCallInvite, updateCallStatus };
}

export function getOrCreateConversation(
  orderId: string,
  buyerId: string,
  type: 'buyer_seller' | 'buyer_rider',
  sellerId?: string | null,
  riderId?: string | null
): Promise<Conversation | null> {
  return (async () => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('order_id', orderId)
      .eq('type', type)
      .maybeSingle();

    if (existing) return existing as Conversation;

    const insert: Record<string, unknown> = {
      order_id: orderId,
      buyer_id: buyerId,
      type,
    };
    if (type === 'buyer_seller') insert.seller_id = sellerId;
    if (type === 'buyer_rider') insert.rider_id = riderId;

    const { data, error } = await supabase
      .from('conversations')
      .insert(insert)
      .select('*')
      .maybeSingle();

    if (error) {
      const { data: retry } = await supabase
        .from('conversations')
        .select('*')
        .eq('order_id', orderId)
        .eq('type', type)
        .maybeSingle();
      return retry as Conversation | null;
    }
    return data as Conversation | null;
  })();
}

function generateRoomId() {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatView({
  conversationId,
  otherName,
  otherRole,
  onBack,
}: {
  conversationId: string;
  otherName: string;
  otherRole: string;
  onBack: () => void;
}) {
  const { profile } = useAuth();
  const { messages, loading, sending, sendMessage, sendCallInvite, updateCallStatus } = useChat(conversationId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ roomId: string; isCaller: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<Message | null>(null);

  useEffect(() => {
    async function loadAvatars() {
      const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
      if (!conv || !profile) return;
      const otherId = conv.type === 'buyer_seller'
        ? (conv.seller_id === profile.id ? conv.buyer_id : conv.seller_id)
        : (conv.buyer_id === profile.id ? conv.rider_id : conv.buyer_id);
      if (otherId) {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', otherId).maybeSingle();
        setOtherAvatar(data?.avatar_url || null);
      }
      const { data: me } = await supabase.from('profiles').select('avatar_url').eq('id', profile.id).maybeSingle();
      setMyAvatar(me?.avatar_url || null);
    }
    loadAvatars();
  }, [conversationId, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Detect incoming video call (message_type = video_call, not from me, status pending)
  useEffect(() => {
    if (!profile) return;
    const latestCallMsg = [...messages].reverse().find(
      m => m.message_type === 'video_call' && m.sender_id !== profile.id && m.call_status === 'pending'
    );
    if (latestCallMsg && !activeCall) {
      setIncomingCall(latestCallMsg);
    } else if (!latestCallMsg) {
      setIncomingCall(null);
    }
  }, [messages, profile, activeCall]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    sendMessage(input);
    setInput('');
  }

  async function startVideoCall() {
    const roomId = generateRoomId();
    await sendCallInvite(roomId);
    setActiveCall({ roomId, isCaller: true });
  }

  async function acceptIncomingCall(msg: Message) {
    if (!msg.call_room_id) return;
    await updateCallStatus(msg.id, 'accepted');
    setActiveCall({ roomId: msg.call_room_id, isCaller: false });
    setIncomingCall(null);
  }

  async function declineIncomingCall(msg: Message) {
    await updateCallStatus(msg.id, 'declined');
    setIncomingCall(null);
  }

  function endActiveCall() {
    if (activeCall) {
      // Find the call message and update its status to ended
      const callMsg = messages.find(m => m.call_room_id === activeCall.roomId);
      if (callMsg) {
        updateCallStatus(callMsg.id, 'ended');
      }
    }
    setActiveCall(null);
  }

  // Show incoming call overlay if there's an incoming call and no active call
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 ring-4 ring-blue-400/50 animate-pulse">
            <Video size={48} className="text-white" />
          </div>
          <p className="text-white text-xl font-bold mb-1">Si {otherName} ay tumatawag</p>
          <p className="text-blue-200 text-sm">Gusto ka nilang tawagan via video</p>
        </div>
        <div className="mt-10 flex gap-8">
          <button onClick={() => declineIncomingCall(incomingCall)} className="flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <PhoneOff size={28} className="text-white" />
            </div>
            <span className="text-red-300 text-xs font-medium">Tanggihan</span>
          </button>
          <button onClick={() => acceptIncomingCall(incomingCall)} className="flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
              <Phone size={28} className="text-white" />
            </div>
            <span className="text-green-300 text-xs font-medium">Tanggapin</span>
          </button>
        </div>
      </div>
    );
  }

  // Show active video call
  if (activeCall) {
    return (
      <VideoCall
        roomId={activeCall.roomId}
        isCaller={activeCall.isCaller}
        otherName={otherName}
        onEnd={endActiveCall}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh max-w-md mx-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <Avatar src={otherAvatar} name={otherName} size={40} />
        <div className="flex-1">
          <p className="font-semibold text-gray-800 text-sm">{otherName}</p>
          <p className="text-xs text-gray-400">{otherRole}</p>
        </div>
        <button
          onClick={startVideoCall}
          className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center active:scale-90 transition flex-shrink-0"
          title="Video Call"
        >
          <Video size={20} className="text-blue-600" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Wala pang messages. Magpadala ng unang mensahe!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === profile?.id;

          // Video call message card
          if (msg.message_type === 'video_call') {
            const status = msg.call_status;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && <Avatar src={otherAvatar} name={otherName} size={28} />}
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  isMine
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Video size={16} className={isMine ? 'text-brand-200' : 'text-blue-500'} />
                    <span className="text-sm font-medium">Video Call</span>
                  </div>
                  <p className={`text-xs ${isMine ? 'text-brand-200' : 'text-gray-500'}`}>
                    {status === 'pending' && (isMine ? 'Naghihintay ng sagot...' : 'May bagong video call invite')}
                    {status === 'accepted' && 'Tinanggap ang video call'}
                    {status === 'declined' && 'Hindi tinanggap ang video call'}
                    {status === 'ended' && 'Natapos ang video call'}
                    {!status && 'Video call invite'}
                  </p>
                  {/* Action buttons for pending incoming call */}
                  {!isMine && status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => acceptIncomingCall(msg)}
                        className="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
                      >
                        <Phone size={14} /> Tanggapin
                      </button>
                      <button
                        onClick={() => declineIncomingCall(msg)}
                        className="flex-1 py-2 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
                      >
                        <PhoneOff size={14} /> Tanggihan
                      </button>
                    </div>
                  )}
                  {/* Re-join button for accepted/ended calls */}
                  {isMine && status === 'pending' && (
                    <button
                      onClick={() => setActiveCall({ roomId: msg.call_room_id!, isCaller: true })}
                      className="mt-2 w-full py-2 bg-white/20 text-white rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <Video size={14} /> Sumali sa call
                    </button>
                  )}
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-brand-200' : 'text-gray-300'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {isMine && <Avatar src={myAvatar} name={profile?.full_name} size={28} />}
              </div>
            );
          }

          // Regular text message
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && <Avatar src={otherAvatar} name={otherName} size={28} />}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                isMine
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-brand-200' : 'text-gray-300'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              {isMine && <Avatar src={myAvatar} name={profile?.full_name} size={28} />}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="bg-blue-50 border-t border-blue-100 px-4 py-3 flex items-center gap-2 safe-bottom">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mag-type ng mensahe..."
          className="flex-1 px-4 py-2.5 rounded-full bg-white text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 transition shadow-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
