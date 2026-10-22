// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { scheduleBetaInvite } from '../../lib/beta-invite.functions';

export function BetaTestersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('beta_testers').select('*').order('created_at', { ascending: false });
    setError(error ? 'Hindi ma-load ang listahan. Siguraduhing na-run ang database/beta-testers.sql.' : null);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
  }

  async function markAdded(t: any) {
    setBusy(t.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await scheduleBetaInvite({ data: { accessToken: session?.access_token || '', testerId: t.id } });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(null);
  }

  async function remove(t: any) {
    if (!confirm(`Tanggalin si ${t.full_name} sa listahan?`)) return;
    await supabase.from('beta_testers').delete().eq('id', t.id);
    load();
  }

  const pending = rows.filter(r => r.status === 'pending');

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Beta Testers</h2>
          <p className="text-xs text-muted-foreground">I-copy ang emails, idagdag sa Google Play Console, tapos pindutin ang "Na-add na". Agad nilang matatanggap ang email na may download link.</p>
        </div>
        <div className="flex gap-2">
          {pending.length > 0 && (
            <button onClick={() => copy(pending.map(r => r.email).join(', '), 'all')} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold">
              {copied === 'all' ? <Check size={14} /> : <Copy size={14} />} Copy lahat ng pending ({pending.length})
            </button>
          )}
          <button onClick={load} aria-label="I-refresh" className="rounded-lg border border-border bg-card p-1.5"><RefreshCw size={14} /></button>
        </div>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <Loader2 className="animate-spin text-primary" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Wala pang sumasali.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="p-2">#</th><th className="p-2">Pangalan</th><th className="p-2">Email</th><th className="p-2">Sumali</th><th className="p-2">Status</th><th className="p-2 text-right">Aksyon</th></tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium">{t.full_name}</td>
                  <td className="p-2">
                    <button onClick={() => copy(t.email, t.id)} className="inline-flex items-center gap-1 hover:text-primary" title="Copy email">
                      {t.email} {copied === t.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('en-PH')}</td>
                  <td className="p-2">
                    {t.status === 'pending'
                      ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Pending</span>
                      : <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Naipadala ang email</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {t.status === 'pending' && (
                        <button onClick={() => markAdded(t)} disabled={busy === t.id} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                          {busy === t.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Na-add na sa Play Console
                        </button>
                      )}
                      <button onClick={() => remove(t)} aria-label="Tanggalin" className="rounded-md p-1 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
