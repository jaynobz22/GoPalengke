import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AdminCall } from '@/lib/types';

export function useIncomingAdminCall() {
  const { profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<AdminCall | null>(null);
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;

    async function checkExisting() {
      const { data } = await supabase
        .from('admin_calls')
        .select('*')
        .eq('target_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const call = data as AdminCall;
        setIncomingCall(call);
        const { data: admin } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', call.admin_id)
          .maybeSingle();
        if (admin) setAdminName(admin.full_name);
      }
    }
    checkExisting();

    const sub = supabase.channel(`admin-call-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_calls', filter: `target_user_id=eq.${userId}` },
        async (payload: any) => {
          const call = payload.new as AdminCall;
          if (call.status === 'pending') {
            setIncomingCall(call);
            const { data: admin } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', call.admin_id)
              .maybeSingle();
            if (admin) setAdminName(admin.full_name);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_calls', filter: `target_user_id=eq.${userId}` },
        (payload: any) => {
          const call = payload.new as AdminCall;
          if (call.status !== 'pending') {
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  function clearCall() {
    setIncomingCall(null);
  }

  return { incomingCall, adminName, clearCall };
}
