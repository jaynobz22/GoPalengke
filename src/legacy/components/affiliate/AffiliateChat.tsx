// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Shield, Loader2 } from 'lucide-react';

export interface AffiliateMessage {
  id: string;
  affiliate_id: string;
  sender: 'admin' | 'affiliate';
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

/** Chat between admin and one affiliate. `viewer` decides whose bubbles are "mine". */
export function AffiliateChat({ affiliateId, viewer, title }: { affiliateId: string; viewer: 'admin' | 'affiliate'; title?: string }) {
  const [messages, setMessages] = useState<AffiliateMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('affiliate_messages')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: true });
    if (error) { setError('Hindi ma-load ang mga mensahe.'); return; }
    setError(null);
    const list = (data || []) as AffiliateMessage[];
    setMessages(list);
    const unread = list.filter(m => m.sender !== viewer && !m.read_at).map(m => m.id);
    if (unread.length) {
      await supabase.from('affiliate_messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    }
  }, [affiliateId, viewer]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`aff-chat-${affiliateId}-${viewer}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'affiliate_messages', filter: `affiliate_id=eq.${affiliateId}` }, () => load())
      .subscribe();
    const t = setInterval(load, 8000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [affiliateId, viewer, load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from('affiliate_messages').insert({ affiliate_id: affiliateId, sender: viewer, body, kind: 'text' });
    setSending(false);
    if (error) { setError('Hindi naipadala. Subukan ulit.'); return; }
    setInput('');
    load();
  }

  return (
    <div className="flex flex-col h-[60vh] min-h-[360px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-green-700 text-white">
        <Shield size={18} />
        <p className="font-semibold text-sm truncate">{title || (viewer === 'affiliate' ? 'GoPalengke Admin' : 'Affiliate')}</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">
            {viewer === 'affiliate' ? 'May tanong? Mag-message lang sa admin dito.' : 'Wala pang mensahe.'}
          </p>
        )}
        {messages.map(m => {
          const mine = m.sender === viewer;
          if (m.kind === 'payout_sent') {
            return (
              <div key={m.id} className="mx-auto max-w-[90%] rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                <p className="text-sm font-bold text-green-700">✅ Payout Sent</p>
                <p className="text-sm text-green-800 whitespace-pre-wrap">{m.body}</p>
                <p className="text-[10px] text-green-600 mt-1">{new Date(m.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-green-600 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="px-3 py-1 text-xs text-red-600 bg-red-50">{error}</p>}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-gray-100 p-2.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mag-type ng mensahe..."
          className="flex-1 min-w-0 h-11 px-4 rounded-full bg-gray-100 border border-gray-200 outline-none text-sm focus:border-green-400"
        />
        <button type="submit" disabled={!input.trim() || sending} aria-label="Ipadala" className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center disabled:opacity-40">
          {sending ? <Loader2 size={18} className="animate-spin text-white" /> : <Send size={18} className="text-white" />}
        </button>
      </form>
    </div>
  );
}

/** Count of unread messages sent to `viewer` (optionally for one affiliate). */
export async function countUnreadAffiliateMessages(viewer: 'admin' | 'affiliate', affiliateId?: string) {
  let q = supabase.from('affiliate_messages').select('id', { count: 'exact', head: true })
    .is('read_at', null).neq('sender', viewer);
  if (affiliateId) q = q.eq('affiliate_id', affiliateId);
  const { count, error } = await q;
  return error ? 0 : (count ?? 0);
}
