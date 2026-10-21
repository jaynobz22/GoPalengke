// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Message, Conversation } from '../lib/types';
import { scanMessageLocally, scanChatMessage } from '../lib/security';
import { ArrowLeft, Send, Video, PhoneOff, Phone, ImagePlus, Trash2, X, ShieldAlert, AlertCircle, ExternalLink, MapPin, Calendar } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { VideoCall } from '../components/VideoCall';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { compressImage } from '../lib/imageCompress';

export function useRingtone() {
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

    let cancelled = false;

    const pollMessages = async () => {
      if (cancelled) return;
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        if (!cancelled && data) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.filter(m => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
        }
      } catch { /* ignore */ }
    };

    pollMessages();

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

    const pollTimer = setInterval(pollMessages, 2000);

    return () => {
      cancelled = true;
      supabase.removeChannel(sub);
      clearInterval(pollTimer);
    };
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

  const sendImage = useCallback(async (file: File): Promise<string | null> => {
    if (!conversationId || !profile) return 'Chat is not ready yet.';

    const MAX_SOURCE_FILE_SIZE = 20 * 1024 * 1024;
    const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SOURCE_FILE_SIZE) {
      return 'Image is too large. Please choose a photo under 20MB.';
    }

    setSending(true);

    // Insert a temporary "sending" placeholder so the user sees immediate feedback
    const placeholderId = `sending-${Date.now()}`;
    const placeholder: Message = {
      id: placeholderId,
      conversation_id: conversationId,
      sender_id: profile.id,
      body: null,
      image_url: null,
      read_at: null,
      created_at: new Date().toISOString(),
      message_type: 'image',
      call_room_id: null,
      call_status: null,
    };
    setMessages(prev => [...prev, placeholder]);

    try {
      // Try to compress the image; if compression fails (e.g. HEIC from iPhone,
      // older browsers without canvas.toBlob support), fall back to the original file.
      let uploadFile: File = file;
      let uploadContentType = file.type || 'image/jpeg';
      let uploadExt = 'jpg';

      try {
        const compressed = await compressImage(file);
        uploadFile = compressed;
        uploadExt = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
        uploadContentType = compressed.type || `image/${uploadExt}`;
      } catch {
        // Compression failed — use original file as-is
        const origExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
        uploadExt = origExt;
        uploadContentType = file.type || `image/${origExt}`;
      }

      if (uploadFile.size > MAX_UPLOAD_FILE_SIZE) {
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
        setSending(false);
        return 'Image is still too large after compression. Please choose a smaller photo.';
      }

      // Build a clean Blob for reliable backend ingestion
      const blob = new Blob([uploadFile], { type: uploadContentType });

      // Unique file path: conversationId/timestamp_randomname.ext
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 40);
      const filePath = `${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}.${uploadExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, blob, { contentType: uploadContentType, upsert: false });

      if (uploadError) {
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
        setSending(false);
        return `Upload failed: ${uploadError.message || 'Please try again.'}`;
      }

      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(filePath);

      const { data, error: insertError } = await supabase
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

      if (insertError) {
        await supabase.storage.from('chat-images').remove([filePath]);
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
        setSending(false);
        return `Failed to send image: ${insertError.message || 'Please try again.'}`;
      }

      // Replace placeholder with the real message
      setMessages(prev => prev.map(m => m.id === placeholderId ? (data as Message) : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== placeholderId));
      setSending(false);
      return e instanceof Error ? e.message : 'Image upload failed. Please try again.';
    }
    setSending(false);
    return null;
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

/** Direct buyer→seller inquiry chat (walang order pa). Isang usapan lang kada buyer+seller. */
export async function getOrCreateStoreInquiry(buyerId: string, sellerId: string): Promise<{ conv: Conversation | null; error?: string }> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .is('order_id', null)
    .eq('type', 'buyer_seller')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .limit(1)
    .maybeSingle();
  if (existing) return { conv: existing as Conversation };
  const { data, error } = await supabase
    .from('conversations')
    .insert({ order_id: null, buyer_id: buyerId, seller_id: sellerId, type: 'buyer_seller' })
    .select('*')
    .maybeSingle();
  if (error) return { conv: null, error: error.message };
  return { conv: data as Conversation | null };
}

/** Direct buyer→rider inquiry chat (walang order pa) para sa bao-bao/minivan. Isang usapan lang kada buyer+rider. */
export async function getOrCreateRiderInquiry(buyerId: string, riderId: string): Promise<{ conv: Conversation | null; error?: string }> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .is('order_id', null)
    .eq('type', 'buyer_rider')
    .eq('buyer_id', buyerId)
    .eq('rider_id', riderId)
    .limit(1)
    .maybeSingle();
  if (existing) return { conv: existing as Conversation };
  const { data, error } = await supabase
    .from('conversations')
    .insert({ order_id: null, buyer_id: buyerId, rider_id: riderId, type: 'buyer_rider' })
    .select('*')
    .maybeSingle();
  if (error) return { conv: null, error: error.message };
  return { conv: data as Conversation | null };
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
  const [preWarmedStream, setPreWarmedStream] = useState<MediaStream | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showOtherProfile, setShowOtherProfile] = useState(false);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [otherStore, setOtherStore] = useState<any>(null);
  const [loadingOtherProfile, setLoadingOtherProfile] = useState(false);
  const otherIdRef = useRef<string | null>(null);

  async function openOtherProfile() {
    const otherId = otherIdRef.current;
    if (!otherId) return;
    setShowOtherProfile(true);
    setLoadingOtherProfile(true);
    setOtherStore(null);
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, role, phone, barangay, city, region, complete_address, house_photo_url, rider_age, rider_family_status, rider_residence_address, rider_plate_number, rider_motor_model, created_at').eq('id', otherId).maybeSingle();
    setOtherProfile(data || null);
    if (data?.role === 'seller') {
      const { data: store } = await supabase.from('stores').select('name, logo_url, palengke_name, barangay, city, rating, seller_type').eq('seller_id', otherId).maybeSingle();
      setOtherStore(store || null);
    }
    setLoadingOtherProfile(false);
  }

  const videoCallSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
  const { start: startRing, stop: stopRing } = useRingtone();
  const preWarmStreamRef = useRef<MediaStream | null>(null);

  // Ipaalam sa global call listener na bukas ang chat na ito (dito na magri-ring)
  useEffect(() => {
    (window as any).__gpOpenChatConv = conversationId;
    return () => { if ((window as any).__gpOpenChatConv === conversationId) (window as any).__gpOpenChatConv = null; };
  }, [conversationId]);

  useEffect(() => {
    async function loadAvatars() {
      const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
      if (!conv || !profile) return;
      const otherId = conv.type === 'buyer_seller'
        ? (conv.seller_id === profile.id ? conv.buyer_id : conv.seller_id)
        : (conv.buyer_id === profile.id ? conv.rider_id : conv.buyer_id);
      otherIdRef.current = otherId || null;
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

  // Huwag nang hawakan ang camera habang nagri-ring — naiiwang naka-lock ito sa mobile
  // at hindi na makuha ng video call. Linisin na lang ang natitirang stream.
  useEffect(() => {
    if (!incomingCall && !activeCall && preWarmStreamRef.current) {
      preWarmStreamRef.current.getTracks().forEach(t => t.stop());
      preWarmStreamRef.current = null;
      setPreWarmedStream(null);
    }
  }, [incomingCall, activeCall, videoCallSupported]);


  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    sendMessage(input);
    setInput('');
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Safely extract the first file — mobile browsers may wrap metadata differently
    const file = files[0];
    if (!file) return;

    // Validate it is an image type
    if (!file.type || !file.type.startsWith('image/')) {
      setImageError('Please select a valid image file.');
      setTimeout(() => setImageError(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImageError(null);
    setUploadingImage(true);
    const err = await sendImage(file);
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (err) {
      setImageError(err);
      setTimeout(() => setImageError(null), 4000);
    }
  }

  async function startVideoCall() {
    if (!videoCallSupported) {
      setShowCallUnsupported(true);
      return;
    }
    // Credit check: caller must have at least 1 credit
    if (profile && (profile.video_credits ?? 0) <= 0) {
      alert('Ubos na ang iyong video credits. Mag-top up upang makatawag muli.');
      return;
    }
    // Hingin ang camera permission sa loob ng tap, pero pakawalan agad
    // para malaya itong makuha ng Jitsi (kung hindi, naka-lock ang camera sa mobile).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      // Ituloy pa rin — hihingi ulit ang Jitsi
    }
    if (preWarmStreamRef.current) {
      preWarmStreamRef.current.getTracks().forEach(t => t.stop());
      preWarmStreamRef.current = null;
      setPreWarmedStream(null);
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
    // Acquire camera WITHIN the user tap — mobile browsers require this — then release it
    // agad para makuha ito ng Jitsi.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      // Ituloy pa rin — hihingi ulit ang Jitsi
    }
    if (preWarmStreamRef.current) {
      preWarmStreamRef.current.getTracks().forEach(t => t.stop());
      preWarmStreamRef.current = null;
      setPreWarmedStream(null);
    }

    setIncomingCall(null);
    setActiveCall({ roomId: msg.call_room_id, isCaller: false });
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
    // Clean up pre-warmed stream
    if (preWarmStreamRef.current) {
      preWarmStreamRef.current.getTracks().forEach(t => t.stop());
      preWarmStreamRef.current = null;
      setPreWarmedStream(null);
    }
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
        <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-5">
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
      <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
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
      <ErrorBoundary fallback={
        <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-5">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={36} className="text-white" />
            </div>
            <p className="text-white text-lg font-semibold mb-2">May problema sa video call</p>
            <p className="text-gray-400 text-sm mb-6">Subukang buksan sa browser o i-refresh ang page.</p>
          </div>
          <button onClick={endActiveCall} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">
            Bumalik sa Chat
          </button>
        </div>
      }>
        <VideoCall
          roomId={activeCall.roomId}
          isCaller={activeCall.isCaller}
          autoAccept={!activeCall.isCaller}
          otherName={otherName}
          preWarmedStream={preWarmedStream}
          onEnd={endActiveCall}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] mx-auto flex h-[100dvh] w-full max-w-4xl min-w-0 flex-col overflow-hidden border-x border-brand-300 bg-brand-100 shadow-2xl">
      {/* Header */}
      <div className="safe-top z-10 flex w-full min-w-0 shrink-0 items-center gap-2 border-b border-brand-200 bg-brand-50 px-3 py-2.5">
        <button onClick={onBack} aria-label="Bumalik" className="h-8 gap-1 px-2.5 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 active:scale-95 transition">
          <ArrowLeft size={14} className="text-gray-600" /> <span>Bumalik</span>
        </button>
        <button onClick={openOtherProfile} aria-label={`Tingnan ang profile ni ${otherName}`} className="shrink-0 rounded-full active:scale-90 transition">
          <Avatar src={otherAvatar} name={otherName} size={40} />
        </button>
        <button onClick={openOtherProfile} className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-gray-800 text-sm truncate">{otherName}</p>
          <p className="text-xs text-gray-400">{otherRole}</p>
        </button>
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
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 space-y-2">
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
                    : 'bg-white text-gray-800 border border-brand-200 rounded-bl-md'
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
                <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? 'rounded-br-md' : 'rounded-bl-md bg-white border border-brand-200'}`}>
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

          // Sending photo placeholder (temporary, no image_url yet)
          if (msg.message_type === 'image' && !msg.image_url) {
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && <Avatar src={otherAvatar} name={otherName} size={28} />}
                <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? 'rounded-br-md bg-brand-600' : 'rounded-bl-md bg-white border border-brand-200'}`}>
                  <div className="w-48 h-40 flex flex-col items-center justify-center gap-2 bg-gray-100">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 font-medium">Sending photo...</span>
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
                  : 'bg-white text-gray-800 border border-brand-200 rounded-bl-md'
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
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-2" onClick={() => setPreviewImage(null)}>
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
      <form onSubmit={handleSend} className="chat-composer grid w-full min-w-0 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 border-t border-brand-200 bg-brand-50 px-3 pt-3">
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
          disabled={sending || uploadingImage}
          className="w-11 h-11 rounded-full bg-white border border-brand-200 flex items-center justify-center active:scale-90 transition disabled:opacity-40 flex-shrink-0 shadow-sm"
        >
          {uploadingImage ? (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
          ) : (
            <ImagePlus size={20} className="text-brand-600" />
          )}
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mag-type ng mensahe..."
          className="h-11 w-full min-w-0 px-4 py-2.5 rounded-full bg-white border border-brand-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 transition shadow-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Profile popup ng ka-chat */}
      {showOtherProfile && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowOtherProfile(false)}>
          <div className="relative bg-white rounded-3xl w-full max-w-sm max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-brand-600 px-4 py-3 shrink-0">
              <p className="text-white text-sm font-semibold">Profile ng ka-chat</p>
              <button onClick={() => setShowOtherProfile(false)} aria-label="Isara" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition">
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6">
              {loadingOtherProfile ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => { const src = otherProfile?.avatar_url || otherAvatar; if (src) setPreviewImage(src); }}
                      className="rounded-full ring-4 ring-brand-100 shadow-lg active:scale-95 transition"
                      aria-label="Tingnan ang profile pic"
                    >
                      <Avatar src={otherProfile?.avatar_url || otherAvatar} name={otherProfile?.full_name || otherName} size={112} />
                    </button>
                  </div>
                  <p className="mt-3 text-center text-lg font-bold text-gray-800">{otherProfile?.full_name || otherName}</p>
                  <p className="text-center text-xs text-gray-400 capitalize">{otherProfile?.role || otherRole}</p>


                  {/* Contact at address */}
                  <div className="mt-4 bg-gray-50 rounded-2xl p-3 space-y-2">
                    {otherProfile?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400 shrink-0" />
                        <a href={`tel:${otherProfile.phone}`} className="text-xs text-brand-600 font-medium underline">{otherProfile.phone}</a>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        {otherProfile?.complete_address && <p className="text-xs text-gray-700 font-medium">{otherProfile.complete_address}</p>}
                        <p className="text-xs text-gray-600">
                          {[otherProfile?.barangay, otherProfile?.city, otherProfile?.region].filter(Boolean).join(', ') || <span className="text-gray-300 italic">Walang nakalagay na address</span>}
                        </p>
                      </div>
                    </div>
                    {otherProfile?.created_at && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-600">Member mula {new Date(otherProfile.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</p>
                      </div>
                    )}
                  </div>

                  {/* Buyer: larawan ng bahay */}
                  {otherProfile?.role === 'buyer' && otherProfile?.house_photo_url && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Larawan ng Bahay</p>
                      <button type="button" onClick={() => setPreviewImage(otherProfile.house_photo_url)} className="block w-full rounded-2xl overflow-hidden border border-gray-200">
                        <img src={otherProfile.house_photo_url} alt="Bahay ng buyer" className="w-full h-48 object-cover" />
                      </button>
                    </div>
                  )}

                  {/* Rider: detalye ng sasakyan */}
                  {otherProfile?.role === 'rider' && (
                    <div className="mt-3 bg-gray-50 rounded-2xl p-3">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Detalye ng Rider</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-gray-400">Plate Number</p>
                          <p className="font-medium text-gray-700">{otherProfile?.rider_plate_number || <span className="text-gray-300 italic">Wala</span>}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Motor Model</p>
                          <p className="font-medium text-gray-700">{otherProfile?.rider_motor_model || <span className="text-gray-300 italic">Wala</span>}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Edad</p>
                          <p className="font-medium text-gray-700">{otherProfile?.rider_age ? otherProfile.rider_age + ' taon' : <span className="text-gray-300 italic">Wala</span>}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Family Status</p>
                          <p className="font-medium text-gray-700">{otherProfile?.rider_family_status || <span className="text-gray-300 italic">Wala</span>}</p>
                        </div>
                      </div>
                      {otherProfile?.rider_residence_address && (
                        <p className="text-xs text-gray-600 mt-2"><span className="text-[10px] text-gray-400 block">Tirahan</span>{otherProfile.rider_residence_address}</p>
                      )}
                    </div>
                  )}

                  {/* Seller: tindahan */}
                  {otherProfile?.role === 'seller' && otherStore && (
                    <div className="mt-3 bg-gray-50 rounded-2xl p-3">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Tindahan</p>
                      <div className="flex items-center gap-2">
                        {otherStore.logo_url ? (
                          <img src={otherStore.logo_url} alt={otherStore.name} className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold">{(otherStore.name || 'T').charAt(0)}</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800 truncate">{otherStore.name}</p>
                          <p className="text-[10px] text-gray-400">{[otherStore.palengke_name || otherStore.barangay, otherStore.city].filter(Boolean).join(', ')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        <div>
                          <p className="text-[10px] text-gray-400">Uri ng Seller</p>
                          <p className="font-medium text-gray-700 capitalize">{otherStore.seller_type || 'Regular'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Rating</p>
                          <p className="font-medium text-gray-700">{otherStore.rating > 0 ? Number(otherStore.rating).toFixed(1) + ' / 5' : 'Wala pa'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image upload error toast */}
      {imageError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90%] px-4 py-3 bg-red-500 text-white text-sm rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{imageError}</span>
        </div>
      )}
    </div>
  );
}
