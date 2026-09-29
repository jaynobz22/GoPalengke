// @ts-nocheck
import { useEffect, useState } from 'react';
import { Mail, Loader2, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { onboardingReminders } from '@/lib/onboarding-reminders.functions';

export function OnboardingReminders() {
  const [counts, setCounts] = useState<{ seller: number; rider: number; buyer: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run(send: boolean) {
    setBusy(true);
    setMsg('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Mag-login ulit bilang admin.');
      const r = await onboardingReminders({ data: { accessToken: token, send } });
      setCounts(r.counts);
      setTotal(r.total);
      if (send) {
        setMsg(`Naipadala: ${r.sent}${r.failed ? ` · Pumalya: ${r.failed}` : ''}${r.errors.length ? ` — ${r.errors[0]}` : ''}`);
        const again = await onboardingReminders({ data: { accessToken: token, send: false } });
        setCounts(again.counts);
        setTotal(again.total);
      }
    } catch (e: any) {
      const m = String(e?.message || e);
      setMsg(m.includes('onboarding_reminder') ? 'Kailangan munang i-run ang onboarding-reminders.sql sa database.' : m);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { run(false); }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Mail size={18} className="text-brand-600" />
        <p className="font-bold text-gray-900">Onboarding Reminders</p>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Email paalala sa mga account na hindi pa tapos mag-setup (24 oras pagka-register, at huling paalala pagkalipas ng 7 araw).
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        {[['Sellers', counts?.seller], ['Riders', counts?.rider], ['Buyers', counts?.buyer]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-gray-50 py-2">
            <p className="text-lg font-bold text-gray-900">{v ?? '—'}</p>
            <p className="text-[11px] text-gray-500">{l}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() => { if (confirm(`Magpadala ng reminder sa ${Math.min(total, 40)} account?`)) run(true); }}
        disabled={busy || !total}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Magpadala ng Onboarding Reminders
      </button>
      {total > 40 && <p className="text-[11px] text-gray-500 mt-2">Hanggang 40 kada pindot para iwas-spam filter.</p>}
      {msg && <p className="text-xs text-gray-700 mt-2">{msg}</p>}
    </div>
  );
}
