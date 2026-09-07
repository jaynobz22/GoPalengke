import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminMessage } from '@/lib/types';
import { ArrowLeft, Send, Shield } from 'lucide-react';

interface AdminChatProps {
  conversationId: string;
  currentUserId: string;
  otherName: string;
  isAdmin: boolean;
  onBack: () => void;
}

export function AdminChat({ conversationId, currentUserId, otherName, isAdmin, onBack }: AdminChatProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
            <p className="text-white font-semibold text-sm truncate">{otherName}</p>
            <p className="text-white/60 text-xs">{isAdmin ? 'Admin Support' : 'GoPalengke Admin'}</p>
          </div>
        </div>
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
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMine
                  ? (isAdmin ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white')
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-2">
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
