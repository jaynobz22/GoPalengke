// @ts-nocheck
import { useState } from 'react';
import { useAffiliateAuth } from '../../lib/affiliateAuth';
import { navigate } from '../../lib/router';
import {
  ArrowLeft, Mail, Lock, User, Tag, Eye, EyeOff,
  Check, Loader2, AlertCircle, QrCode, Phone,
} from 'lucide-react';
import { ImageUploadField } from '../../components/ImageUploadField';
import { sendAffiliateResetCode, resetAffiliatePassword } from '@/lib/affiliate-reset.functions';

function AffiliateForgot({ initialEmail, onDone }: { initialEmail: string; onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendCode() {
    setErr(null);
    if (!email.trim()) return setErr('Ilagay ang email mo.');
    setBusy(true);
    try { await sendAffiliateResetCode({ data: { email: email.trim() } }); setStep('code'); }
    catch (e: any) { setErr(e?.message || 'May problema. Subukan ulit.'); }
    setBusy(false);
  }
  async function save() {
    setErr(null);
    if (!/^\d{6}$/.test(code.trim())) return setErr('Ilagay ang 6-digit na code.');
    if (pw.length < 6) return setErr('Dapat hindi bababa sa 6 character ang password.');
    setBusy(true);
    try { await resetAffiliatePassword({ data: { email: email.trim(), code: code.trim(), password: pw } }); setStep('done'); }
    catch (e: any) { setErr(e?.message || 'Mali o expired na ang code.'); }
    setBusy(false);
  }
  const input = 'w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500';
  const btn = 'w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2';
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      <div className="px-5 pt-12 pb-6 flex items-center gap-3">
        <button onClick={onDone} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-95 transition"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold text-gray-800">Bagong Password</h1>
      </div>
      <div className="flex-1 px-5 pb-8"><div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg p-6 space-y-4">
        {err && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm p-3 rounded-xl"><AlertCircle size={16} />{err}</div>}
        {step === 'email' && (<>
          <p className="text-sm text-gray-600">Ilagay ang email ng affiliate account mo. Padadalhan ka namin ng 6-digit na code.</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className={input} />
          <button onClick={sendCode} disabled={busy} className={btn}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}Ipadala ang Code</button>
        </>)}
        {step === 'code' && (<>
          <p className="text-sm text-gray-600">Kung may account ang <b>{email}</b>, may code na sa email mo (tingnan din ang Spam).</p>
          <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className={input + ' tracking-widest text-center'} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Bagong password (6+ character)" className={input} />
          <button onClick={save} disabled={busy} className={btn}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}I-save ang Bagong Password</button>
          <button onClick={sendCode} disabled={busy} className="w-full text-xs text-brand-600 font-semibold">Ipadala ulit ang code</button>
        </>)}
        {step === 'done' && (<>
          <p className="text-sm text-gray-700">Napalitan na ang password mo! Mag-login na gamit ang bagong password.</p>
          <button onClick={onDone} className={btn}><Check size={18} />Bumalik sa Login</button>
        </>)}
      </div></div>
    </div>
  );
}

export function AffiliateAuth({ mode }: { mode: 'register' | 'login' }) {
  const { signIn, signUp } = useAffiliateAuth();
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [payoutQrUrl, setPayoutQrUrl] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (isLogin) {
      if (!email.trim() || !password) {
        setError('Punan ang email at password.');
        setSubmitting(false);
        return;
      }
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setSubmitting(false);
      } else {
        navigate('/affiliate/dashboard');
      }
    } else {
      if (!email.trim() || !password || !fullName.trim() || !phone.trim() || !payoutQrUrl.trim()) {
        setError('Punan ang lahat ng kailangan at mag-upload ng QR code.');
        setSubmitting(false);
        return;
      }
      if (password.length < 6) {
        setError('Dapat hindi bababa sa 6 character ang password.');
        setSubmitting(false);
        return;
      }
      const { error } = await signUp({ email, password, full_name: fullName, phone, payout_qr_url: payoutQrUrl, promo_code: promoCode });
      if (error) {
        setError(error);
        setSubmitting(false);
      } else {
        navigate('/affiliate/dashboard');
      }
    }
  }

  function switchMode() {
    setIsLogin(!isLogin);
    setError(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setPayoutQrUrl('');
    setPromoCode('');
  }

  if (showForgot) return <AffiliateForgot initialEmail={email} onDone={() => setShowForgot(false)} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/affiliate')}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/images/Copilot_20260907_183703.jpg" alt="GoPalengke" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <span className="text-xl font-bold text-gray-800">GoPalengke</span>
            <span className="text-xs text-brand-600 font-medium ml-1">Affiliate</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 flex flex-col items-center justify-center pb-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
              {isLogin ? <Lock size={28} className="text-white" /> : <User size={28} className="text-white" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isLogin ? 'Affiliate Login' : 'Join as Affiliate Partner'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isLogin ? 'Mag-sign in sa iyong affiliate account' : 'Gumawa ng affiliate account at simulaang kumita'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Buong Pangalan</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Phone Number</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isLogin ? 'Password' : 'Hindi bababa sa 6 character'}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:scale-90"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {isLogin && (
                <div className="text-right mt-1.5">
                  <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-brand-600 font-semibold hover:underline">
                    Nakalimutan ang password?
                  </button>
                </div>
              )}
            </div>

            {!isLogin && (
              <>
                <ImageUploadField
                  label="Payout QR Code"
                  value={payoutQrUrl}
                  onChange={setPayoutQrUrl}
                  bucket="profile-images"
                  folder="affiliate-qr"
                  aspectClass="h-48"
                  cropAspect={1}
                  icon={<QrCode size={16} className="text-gray-500" />}
                  hint="Mag-upload ng QR code para sa pagtanggap ng payout (GCash, Maya, Bank transfer, atbp.)"
                />

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Promo Code (Optional)</label>
                  <div className="relative">
                    <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value)}
                      placeholder="Hal. WELCOME2026"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : isLogin ? <Check size={18} /> : <User size={18} />}
              {submitting ? 'Nagproproseso...' : isLogin ? 'Mag-sign In' : 'Gumawa ng Account'}
            </button>
          </form>

          {/* Switch */}
          <p className="text-center text-sm text-gray-500 mt-4">
            {isLogin ? 'Wala pang account?' : 'May account na?'}{' '}
            <button
              onClick={switchMode}
              className="text-brand-600 font-semibold hover:underline"
            >
              {isLogin ? 'Mag-register' : 'Mag-login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
