// @ts-nocheck
import { useState } from 'react';
import { ArrowLeft, Mail, MessageCircle, UserX, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SUPPORT_EMAIL = 'admin@gopalengke.net';

export function ContactPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'buyer', reason: '' });
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return setError('Pakilagay ang tamang email address.');
    if (!form.full_name.trim() || form.full_name.length > 100) return setError('Pakilagay ang iyong pangalan.');
    if (form.phone.length > 20) return setError('Masyadong mahaba ang phone number.');
    if (!confirm) return setError('Pakikumpirma na naiintindihan mong permanente ang pagbura.');
    setSending(true);
    const { error: err } = await supabase.from('account_deletion_requests').insert({
      full_name: form.full_name.trim().slice(0, 100),
      email,
      phone: form.phone.trim().slice(0, 20) || null,
      role: form.role,
      reason: form.reason.trim().slice(0, 1000) || null,
    });
    setSending(false);
    if (err) {
      // Fallback: open email so the request is never lost
      const body = `Account Deletion Request\n\nName: ${form.full_name}\nEmail: ${email}\nPhone: ${form.phone}\nRole: ${form.role}\nReason: ${form.reason}`;
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Account Deletion Request')}&body=${encodeURIComponent(body)}`;
    }
    setDone(true);
  }

  const input = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 pt-6 pb-8 text-white">
        <div className="max-w-3xl mx-auto">
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:scale-95 transition mb-4">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Contact Us</h1>
          <p className="text-brand-100 text-sm mt-2">Nandito kami para tumulong — tanong, reklamo, o account deletion.</p>
        </div>
      </div>

      <div className="px-5 py-6 max-w-3xl mx-auto pb-16 space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8 space-y-4 text-sm text-gray-700">
          <h2 className="text-lg font-bold text-gray-900">Paano kami makontak</h2>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 text-brand-800">
            <Mail size={20} /> <span><strong>Email:</strong> {SUPPORT_EMAIL}</span>
          </a>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <MessageCircle size={20} className="text-brand-600" />
            <span>Naka-login? Gamitin ang <strong>Admin Chat</strong> sa iyong dashboard para sa mabilis na sagot.</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <Clock size={20} className="text-brand-600" />
            <span>Karaniwang sumasagot kami sa loob ng 24–48 oras.</span>
          </div>
        </div>

        <div id="delete-account" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8 space-y-4 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <UserX size={22} className="text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Account & Data Deletion Request</h2>
          </div>
          <p>Maaari mong hilingin na burahin ang iyong GoPalengke account at data. Ipoproseso ito ng admin sa loob ng <strong>7 araw</strong> matapos ma-verify na ikaw ang may-ari ng account.</p>
          <div>
            <p className="font-semibold text-gray-900">Mabubura:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Profile (pangalan, email, phone, address, GPS location)</li>
              <li>Tindahan, produkto at mga litrato (sellers)</li>
              <li>Rider details, valid ID at selfie verification</li>
              <li>Chat messages, larawan sa chat, reviews at affiliate data</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Maaaring panatilihin pansamantala:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Anonymized order at payment records hanggang 5 taon para sa legal, tax at fraud-prevention na layunin.</li>
            </ul>
          </div>

          {done ? (
            <div className="p-4 rounded-xl bg-brand-50 text-brand-800 flex gap-3">
              <CheckCircle2 size={22} className="shrink-0" />
              <p>Natanggap na ang iyong request. Kokontakin ka namin sa email na ibinigay mo para sa kumpirmasyon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input className={input} placeholder="Buong pangalan" maxLength={100} value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              <input className={input} type="email" placeholder="Registered email address" maxLength={255} value={form.email} onChange={e => set('email', e.target.value)} required />
              <input className={input} type="tel" placeholder="Registered mobile number (optional)" maxLength={20} value={form.phone} onChange={e => set('phone', e.target.value)} />
              <select className={input} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="rider">Rider</option>
                <option value="affiliate">Affiliate</option>
              </select>
              <textarea className={input} rows={3} maxLength={1000} placeholder="Dahilan (optional)" value={form.reason} onChange={e => set('reason', e.target.value)} />
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5" />
                Naiintindihan ko na permanente ang pagbura at hindi na ito maibabalik.
              </label>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <button disabled={sending} className="w-full md:w-auto px-6 py-3 rounded-xl bg-red-600 text-white font-semibold active:scale-95 transition disabled:opacity-60">
                {sending ? 'Ipinapadala...' : 'I-submit ang Deletion Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
