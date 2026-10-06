// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { AdminConversation } from './types';

const welcomeTried = new Set<string>();
const cleanupTried = new Set<string>();

export function useAdminConversations() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;

    // Auto-create a default admin conversation if none exists yet
    const { data: existing } = await supabase
      .from('admin_conversations')
      .select('id')
      .eq('user_id', profile.id)
      .limit(1);

    // Unverified sellers: siguraduhing natanggap ang verification message (isang beses lang ipinapadala ng DB)
    if (profile.role === 'seller' && !profile.is_approved && !welcomeTried.has(profile.id)) {
      welcomeTried.add(profile.id);
      await supabase.rpc('send_seller_welcome_message', { p_user_id: profile.id });
    } else if (!existing || existing.length === 0) {
      await supabase.rpc('get_or_create_admin_conversation');
    }

    // Best-effort: linisin ang mga ordinaryong chat images na lampas 24 oras
    if (!cleanupTried.has(profile.id)) {
      cleanupTried.add(profile.id);
      import('./chatImageCleanup').then(m => m.cleanupExpiredChatImages()).catch(() => {});
    }

    const { data } = await supabase
      .from('admin_conversations')
      .select('*')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false });
    const convs = (data || []) as any[];
    setConversations(convs);

    if (convs.length === 0) {
      setUnreadCount(0);
      return;
    }
    const convIds = convs.map(c => c.id);
    const { count } = await supabase
      .from('admin_messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', profile.id)
      .is('read_at', null);
    setUnreadCount(count || 0);
  }, [profile]);

  useEffect(() => {
    load();
    if (!profile) return;
    const sub = supabase.channel(`admin-chat-list-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_conversations', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load, profile]);

  return { conversations, unreadCount, reload: load };
}
