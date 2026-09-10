import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Message, Conversation } from '@/lib/types';
import { scanMessageLocally, scanChatMessage } from '@/lib/security';
import { ArrowLeft, Send, Video, PhoneOff, Phone, ImagePlus, Trash2, X, ShieldAlert, AlertCircle, ExternalLink } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { VideoCall } from '@/components/VideoCall';
import { compressImage } from '@/lib/imageCompress';

function useRingtone() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    try {
      audioCtxRef.current = new AudioContext();
      const playBeep = () => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      };
      playBeep();
      intervalRef.current = setInterval(playBeep, 1500);
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 200, 400, 200, 400]);
        vibrateRef.current = setInterval(() => {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }, 1500);
      }
    } catch { /* ignore */ }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (vibrateRef.current) { clearInterval(vibrateRef.current); vibrateRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if ('vibrate' in navigator) navigator.vibrate(0);
  }, []);

  useEffect(() => () => stop(), [stop]);
  return { start, stop };
}

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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
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
      // Security scan: check for off-platform poaching patterns
      if (scanMessageLocally(body.trim())) {
        const result = await scanChatMessage(profile.id, body.trim(), conversationId, data.id);
        if (result.flagged) {
          // Update the message locally to show redacted version
          setMessages(prev => prev.map(m => m.id === data.id ? { ...m, body: '[REDACTED FOR SECURITY: Account Suspended]' } : m));
          alert('Your message was flagged for attempting to move transactions off GoPalengke. Your account has been suspended pending review.');
          await supabase.auth.signOut();
          return;
        }
      }
    }
    setSending(false);
  }, [conversationId, profile]);

  const sendImage = useCallback(async (file: File) => {
    if (!conversationId || !profile) return;
    setSending(true);
    try {
      const compressed = await compressImage(file);
      const fileName = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, compressed, { contentType: 'image/jpeg' });
      if (uploadError) { setSending(false); return; }
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      const { data } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: profile.id,
          body: null,
          image_url: urlData.publicUrl,
          message_type: 'image',
        })
        .select('*')
        .single();
      if (data) {
        setMessages(prev => [...prev, data]);
      }
    } catch { /* ignore */ }
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

  const deleteMessage = useCallback(async (messageId: string, imageUrl: string | null) => {
    if (imageUrl) {
      const pathMatch = imageUrl.match(/chat-images\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('chat-images').remove([pathMatch[1]]);
      }
    }
    await supabase.from('messages').delete().eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  return { messages, loading, sending, sendMessage, sendImage, sendCallInvite, updateCallStatus, deleteMessage };
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
  const { messages, loading, sending, sendMessage, sendImage, sendCallInvite, updateCallStatus, deleteMessage } = useChat(conversationId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ roomId: string; isCaller: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<Message | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCallUnsupported, setShowCallUnsupported] = useState(false);

  const videoCallSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
  const { start: startRing, stop: stopRing } = useRingtone();

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

  // Ringtone: start when incoming call appears, stop when dismissed/accepted
  useEffect(() => {
    if (incomingCall && !activeCall && videoCallSupported) {
      startRing();
    } else {
      stopRing();
    }
    return () => stopRing();
  }, [incomingCall, activeCall, videoCallSupported, startRing, stopRing]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    sendMessage(input);
    setInput('');
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await sendImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function startVideoCall() {
    if (!videoCallSupported) {
      setShowCallUnsupported(true);
      return;
    }
    const roomId = generateRoomId();
    await sendCallInvite(roomId);
    setActiveCall({ roomId, isCaller: true });
  }

  async function acceptIncomingCall(msg: Message) {
    if (!msg.call_room_id) return;
    if (!videoCallSupported) {
      setShowCallUnsupported(true);
      return;
    }
    stopRing();
    // Mount VideoCall immediately — don't await DB update first.
    // Camera access must happen within the user gesture (click) context.
    setIncomingCall(null);
    setActiveCall({ roomId: msg.call_room_id, isCaller: false });
    // Update DB status in background (non-blocking)
    updateCallStatus(msg.id, 'accepted');
  }

  async function declineIncomingCall(msg: Message) {
    stopRing();
    await updateCallStatus(msg.id, 'declined');
    setIncomingCall(null);
  }

  function endActiveCall() {
    if (activeCall) {
      const callMsg = messages.find(m => m.call_room_id === activeCall.roomId);
      if (callMsg) {
        updateCallStatus(callMsg.id, 'ended');
      }
    }
    setActiveCall(null);
  }

  async function deleteConversation() {
    setDeleting(true);
    const imageMessages = messages.filter(m => m.image_url);
    for (const msg of imageMessages) {
      if (msg.image_url) {
        const pathMatch = msg.image_url.match(/chat-images\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('chat-images').remove([pathMatch[1]]);
        }
      }
    }
    await supabase.from('conversations').delete().eq('id', conversationId);
    setDeleting(false);
    onBack();
  }

  if (incomingCall && !activeCall) {
    if (!videoCallSupported) {
      return (
        <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center max-w-md mx-auto px-5">
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-amber-600 flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">Si {otherName} ay tumatawag</p>
            <p className="text-amber-200 text-sm mb-6">Video call isn't available in the installed app. Open in browser to join.</p>
          </div>
          <button
            onClick={() => {
              const url = window.location.href;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition flex items-center gap-2"
          >
            <ExternalLink size={18} /> Open in Browser
          </button>
          <button
            onClick={() => { declineIncomingCall(incomingCall); setIncomingCall(null); }}
            className="mt-3 text-gray-400 text-sm"
          >
            Dismiss
          </button>
        </div>
      );
    }
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

  if (activeCall) {
    return (
      <VideoCall
        roomId={activeCall.roomId}
        isCaller={activeCall.isCaller}
        autoAccept={!activeCall.isCaller}
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
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{otherName}</p>
          <p className="text-xs text-gray-400">{otherRole}</p>
        </div>
        <button
          onClick={startVideoCall}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition flex-shrink-0 ${videoCallSupported ? 'bg-blue-50' : 'bg-gray-100'}`}
          title={videoCallSupported ? 'Video Call' : 'Video Call (requires browser)'}
        >
          <Video size={20} className={videoCallSupported ? 'text-blue-600' : 'text-gray-400'} />
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center active:scale-90 transition flex-shrink-0"
          title=" Burahin ang usapan"
        >
          <Trash2 size={20} className="text-red-500" />
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

          if (msg.message_type === 'image' && msg.image_url) {
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && <Avatar src={otherAvatar} name={otherName} size={28} />}
                <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? 'rounded-br-md' : 'rounded-bl-md bg-white border border-gray-100'}`}>
                  <img
                    src={msg.image_url}
                    alt="Chat image"
                    className="w-full max-h-60 object-cover cursor-pointer"
                    onClick={() => setPreviewImage(msg.image_url)}
                  />
                  <div className={`flex items-center justify-between px-2 py-1 ${isMine ? 'bg-brand-600' : 'bg-white'}`}>
                    <p className={`text-[10px] ${isMine ? 'text-brand-200' : 'text-gray-300'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {isMine && (
                      <button
                        onClick={() => deleteMessage(msg.id, msg.image_url)}
                        className="text-[10px] text-white/60 hover:text-white transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {isMine && <Avatar src={myAvatar} name={profile?.full_name} size={28} />}
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && <Avatar src={otherAvatar} name={otherName} size={28} />}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                isMine
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-brand-200' : 'text-gray-300'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {isMine && (
                    <button
                      onClick={() => deleteMessage(msg.id, null)}
                      className="text-[10px] text-white/40 hover:text-white/80 transition mt-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
              {isMine && <Avatar src={myAvatar} name={profile?.full_name} size={28} />}
            </div>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <X size={24} className="text-white" />
          </button>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Delete Conversation Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Burahin ang usapan?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Mabubura ang lahat ng messages sa usapang ito. Hindi na ito mababawi.
            </p>
            <button
              onClick={deleteConversation}
              disabled={deleting}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 mb-2"
            >
              {deleting ? 'Binubura...' : 'Oo, Burahin'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
            >
              Huwag na
            </button>
          </div>
        </div>
      )}

      {/* Video Call Unsupported Modal */}
      {showCallUnsupported && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowCallUnsupported(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Video Call Not Available</h3>
            <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">
              Video calls need camera access. If you're seeing this, your home screen shortcut may be outdated. Try removing the app icon from your home screen and re-adding it from the browser, or just use GoPalengke directly in your browser.
            </p>
            <button
              onClick={() => {
                const url = window.location.href;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition flex items-center justify-center gap-2 mb-2"
            >
              <ExternalLink size={18} /> Open in Browser
            </button>
            <button
              onClick={() => setShowCallUnsupported(false)}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="bg-blue-50 border-t border-blue-100 px-4 py-3 flex items-center gap-2 safe-bottom">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="w-11 h-11 rounded-full bg-white flex items-center justify-center active:scale-90 transition disabled:opacity-40 flex-shrink-0 shadow-sm"
        >
          <ImagePlus size={20} className="text-brand-600" />
        </button>
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
