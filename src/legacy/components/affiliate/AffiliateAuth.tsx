// @ts-nocheck
import { useState } from 'react';
import { useAffiliateAuth } from '../../lib/affiliateAuth';
import { navigate } from '../../lib/router';
import {
  ArrowLeft, Mail, Lock, User, Tag, Eye, EyeOff,
  Check, Loader2, AlertCircle, QrCode, Phone,
} from 'lucide-react';
import { ImageUploadField } from '../../components/ImageUploadField';

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
