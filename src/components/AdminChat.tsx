import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminMessage } from '@/lib/types';
import { ArrowLeft, Send, Shield, ImagePlus, Trash2, X, Video } from 'lucide-react';
import { compressImage } from '@/lib/imageCompress';

interface AdminChatProps {
  conversationId: string;
  currentUserId: string;
  otherName: string;
  isAdmin: boolean;
  onBack: () => void;
  onStartCall?: () => void;
}

export function AdminChat({ conversationId, currentUserId, otherName, isAdmin, onBack, onStartCall }: AdminChatProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data || []) as AdminMessage[]);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
    const sub = supabase.channel(`admin-chat-${conversationId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_messages', filter: `conversation_id=eq.${conversationId}` },
        () => loadMessages()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_messages', filter: `conversation_id=eq.${conversationId}` },
        () => loadMessages()
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'admin_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function markAsRead() {
    const unread = messages.filter(m => m.sender_id !== currentUserId && !m.read_at);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    await Promise.all(
      unread.map(m => supabase.from('admin_messages').update({ read_at: now }).eq('id', m.id))
    );
  }

  useEffect(() => {
    markAsRead();
  }, [messages, currentUserId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.from('admin_messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: input.trim(),
    });
    if (!error) {
      setInput('');
      await supabase.from('admin_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    }
    setSending(false);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const compressed = await compressImage(file);
      const fileName = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, compressed, { contentType: 'image/jpeg' });
      if (uploadError) { setSending(false); return; }
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      const { error } = await supabase.from('admin_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        body: null,
        image_url: urlData.publicUrl,
        is_verification_image: !isAdmin,
      });
      if (!error) {
        await supabase.from('admin_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      }
    } catch { /* ignore */ }
    setSending(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deleteMessage(msgId: string, imageUrl: string | null) {
    if (imageUrl) {
      const pathMatch = imageUrl.match(/chat-images\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('chat-images').remove([pathMatch[1]]);
      }
    }
    await supabase.from('admin_messages').delete().eq('id', msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
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
    await supabase.from('admin_conversations').delete().eq('id', conversationId);
    setDeleting(false);
    onBack();
  }

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 shadow-sm ${isAdmin ? 'bg-gray-900' : 'bg-blue-600'}`}>
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? 'bg-white/10' : 'bg-white/15'}`}>
            <Shield size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{isAdmin ? otherName : 'Admin'}</p>
            <p className="text-white/60 text-xs">{isAdmin ? 'Admin Support' : 'GoPalengke Admin'}</p>
          </div>
        </div>
        {isAdmin && onStartCall && (
          <button
            onClick={onStartCall}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition flex-shrink-0"
            title="Video call"
          >
            <Video size={18} className="text-white" />
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition flex-shrink-0"
          title="Burahin ang usapan"
        >
          <Trash2 size={18} className="text-white" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Shield size={28} className="text-blue-400" />
            </div>
            <p className="text-gray-400 text-sm">Magsimula ng usapan</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUserId;

          if (msg.image_url) {
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? (isAdmin ? 'rounded-br-md' : 'rounded-br-md') : 'rounded-bl-md border border-gray-200'}`}>
                  <img
                    src={msg.image_url}
                    alt="Chat image"
                    className="w-full max-h-60 object-cover cursor-pointer"
                    onClick={() => setPreviewImage(msg.image_url)}
                  />
                  <div className={`flex items-center justify-between px-2 py-1 ${isMine ? (isAdmin ? 'bg-gray-800' : 'bg-blue-600') : 'bg-white'}`}>
                    <p className={`text-[10px] ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {isMine && (
                      <button
                        onClick={() => deleteMessage(msg.id, msg.image_url)}
                        className="text-white/40 hover:text-white/80 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMine
                  ? (isAdmin ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white')
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {isMine && (
                    <button
                      onClick={() => deleteMessage(msg.id, null)}
                      className="text-white/30 hover:text-white/60 transition mt-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
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

      {/* Input */}
      <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-2">
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
          className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition disabled:opacity-40 flex-shrink-0"
        >
          <ImagePlus size={20} className={isAdmin ? 'text-gray-700' : 'text-blue-600'} />
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mag-type ng mensahe..."
          className="flex-1 px-4 py-2.5 rounded-full bg-gray-100 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition disabled:opacity-40 ${
            isAdmin ? 'bg-gray-800' : 'bg-blue-600'
          }`}
        >
          <Send size={20} className="text-white" />
        </button>
      </form>
    </div>
  );
}

export async function getOrCreateAdminConversation(adminId: string, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('admin_conversations')
    .select('id')
    .eq('admin_id', adminId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('admin_conversations')
    .insert({ admin_id: adminId, user_id: userId })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}
