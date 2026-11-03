import { useEffect, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BROADCAST_GROUPS, BROADCAST_GROUP_LABEL, type BroadcastGroup } from '../lib/roleBroadcast';
import { countBroadcastRecipients, sendRoleBroadcast } from '../../lib/role-broadcast.functions';

async function token() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error('Hindi naka-login.');
  return t;
}

export function RoleEmailBroadcastButton({ defaultGroup }: { defaultGroup: BroadcastGroup }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold active:scale-95">
      <Mail size={14} /> Magpadala ng Email
    </button>
    {open && <RoleEmailBroadcastModal defaultGroup={defaultGroup} onClose={() => setOpen(false)} />}
  </>;
}

function RoleEmailBroadcastModal({ defaultGroup, onClose }: { defaultGroup: BroadcastGroup; onClose: () => void }) {
  const [group, setGroup] = useState<BroadcastGroup>(defaultGroup);
  const [count, setCount] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setCount(null);
    token().then(t => countBroadcastRecipients({ data: { token: t, group } }))
      .then(r => { if (live) setCount(r.count); })
      .catch(e => { if (live) setError(e?.message || 'Hindi mabilang ang recipients.'); });
    return () => { live = false; };
  }, [group]);

  async function send() {
    if (!subject.trim() || !body.trim()) return setError('Ilagay ang subject at mensahe.');
    if (!confirm(`Ipadala sa ${count ?? 0} ${BROADCAST_GROUP_LABEL[group]}?`)) return;
    setSending(true); setError(null); setResult(null);
    try {
      const r = await sendRoleBroadcast({ data: { token: await token(), group, subject, body } });
      setResult(`Naipadala sa ${r.sent} sa ${r.total}.${r.failed ? ` ${r.failed} ang hindi pumasok. ${r.errors[0] ?? ''}` : ''}`);
      if (!r.failed) { setSubject(''); setBody(''); }
    } catch (e: any) { setError(e?.message || 'Hindi naipadala.'); }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Email sa Specific na Grupo</h3>
          <button onClick={onClose} aria-label="Isara"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1">
          {BROADCAST_GROUPS.map(g => (
            <button key={g} onClick={() => setGroup(g)} className={`py-2 rounded-lg text-xs font-semibold ${group === g ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>{BROADCAST_GROUP_LABEL[g]}</button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{count === null ? 'Binibilang...' : `${count} ${BROADCAST_GROUP_LABEL[group]} lang ang makakatanggap.`}</p>
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} placeholder="Subject" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={10000} rows={8} placeholder="Mensahe..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {result && <p className="text-xs text-green-700">{result}</p>}
        <button onClick={send} disabled={sending || !count} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-40">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? 'Ipinapadala...' : `Ipadala sa ${BROADCAST_GROUP_LABEL[group]}`}
        </button>
      </div>
    </div>
  );
}
