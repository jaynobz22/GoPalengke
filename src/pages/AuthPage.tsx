import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/types';
import { Store, Bike, ShoppingCart, ArrowLeft, Check, Mail, ShieldCheck } from 'lucide-react';
import { LocationSelector, type LocationData } from '@/components/LocationSelector';

const ROLES = [
  { id: 'buyer' as UserRole, name: 'Mamimili', desc: 'Bumili ng sariwang paninda online', icon: ShoppingCart, color: 'bg-brand-500' },
  { id: 'seller' as UserRole, name: 'Tindera/Tindero', desc: 'Magbenta ng paninda sa palengke', icon: Store, color: 'bg-orange-500' },
  { id: 'rider' as UserRole, name: 'Rider', desc: 'Mag-deliver ng orders sa buyers', icon: Bike, color: 'bg-blue-500' },
];

export function AuthPage({ needsProfile = false, onBack }: { needsProfile?: boolean; onBack?: () => void }) {
  const { signIn, signUp, sendEmailOtp, verifyEmailOtp } = useAuth();
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup-role' | 'signup-form' | 'verify-email'>(needsProfile ? 'signup-role' : 'welcome');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<LocationData>({ barangay: '', district: '', city: '', region: 'NCR' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (result.needsVerification && result.userId) {
      setUserId(result.userId);
      setMode('verify-email');
      setInfo('Kailangan i-verify ang email mo bago makapag-login.');
      await sendEmailOtp(email);
      startResendCooldown();
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await signUp(email, password, fullName, selectedRole, { barangay: location.barangay, district: location.district, city: location.city, region: location.region, phone });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (result.userId) {
      setUserId(result.userId);
      setMode('verify-email');
      setInfo('Nagpadala kami ng verification code sa email mo. I-check ang inbox at spam folder.');
      await sendEmailOtp(email);
      startResendCooldown();
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await verifyEmailOtp(email, otpCode);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      setInfo('Nai-verify na ang email mo! Makakapag-login ka na.');
      setMode('signin');
      setOtpCode('');
    }
  }

  async function handleResendEmail() {
    if (resendCooldown > 0) return;
    setError(null);
    const { error } = await sendEmailOtp(email);
    if (error) {
      setError(error);
    } else {
      setInfo('Nagpadala ulit ng bagong verification code sa email mo.');
      startResendCooldown();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-orange-50 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center gap-3">
        {mode !== 'welcome' && (
          <button
            onClick={() => {
              if (mode === 'signin') setMode('welcome');
              else if (mode === 'signup-form') setMode('signup-role');
              else if (mode === 'verify-email') setMode('signup-form');
              else setMode('welcome');
              setError(null);
              setInfo(null);
            }}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-95 transition"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {mode === 'welcome' && onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-95 transition"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-10 h-10 rounded-xl object-cover" />
          <span className="text-xl font-bold text-gray-800">GoPalengke</span>
        </div>
      </div>

      {/* Welcome */}
      {mode === 'welcome' && (
        <div className="flex-1 px-5 flex flex-col">
          <div className="mt-8 mb-10">
            <h1 className="text-2xl font-semibold text-gray-800 leading-tight">
              The First Online<br />Wet Market in the Philippines
            </h1>
            <p className="mt-3 text-gray-500 text-base">
              Sariwang Isda, Karne, Gulay, Prutas at marami pang iba, galing sa Palengke na pinaka malapit, i-deliver sa bahay nyo!
            </p>
          </div>

          <div className="space-y-3 mb-8">
            <button
              onClick={() => setMode('signup-role')}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition"
            >
              Mag-sign Up
            </button>
            <button
              onClick={() => setMode('signin')}
              className="w-full py-4 bg-white text-gray-700 rounded-2xl font-semibold text-lg border border-gray-200 active:scale-[0.98] transition"
            >
              May account na? Mag-sign In
            </button>
          </div>

          <div className="mt-auto pb-8 text-center text-xs text-gray-400">
            <p>By continuing, pumapayag ka sa Terms at Privacy Policy ng GoPalengke.</p>
          </div>
        </div>
      )}

      {/* Role Selection */}
      {mode === 'signup-role' && (
        <div className="flex-1 px-5 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ano ang role mo?</h2>
          <p className="text-gray-500 mb-6">Piliin kung ano ang gagawin mo sa GoPalengke.</p>
          <div className="space-y-3">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const selected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition active:scale-[0.98] ${
                    selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-gray-800">{role.name}</p>
                    <p className="text-sm text-gray-500">{role.desc}</p>
                  </div>
                  {selected && <Check className="text-brand-600" size={24} />}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setMode('signup-form')}
            className="mt-6 w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition"
          >
            Magpatuloy
          </button>
        </div>
      )}

      {/* Sign In */}
      {mode === 'signin' && (
        <div className="flex-1 px-5 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Mag-sign In</h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            {info && <p className="text-brand-600 text-sm bg-brand-50 px-4 py-2 rounded-lg">{info}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {submitting ? 'Naglo-load...' : 'Mag-sign In'}
            </button>
          </form>
        </div>
      )}

      {/* Sign Up Form */}
      {mode === 'signup-form' && (
        <div className="flex-1 px-5 flex flex-col overflow-y-auto pb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Gumawa ng Account</h2>
          <p className="text-gray-500 mb-6">Role: {ROLES.find(r => r.id === selectedRole)?.name}</p>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Buong Pangalan</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan dela Cruz"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Numero ng Telepono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09171234567"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
              <p className="text-xs text-gray-400 mt-1">Kailangan i-verify ang email mo gamit ang verification code.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Hindi bababa sa 6 na karakter"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>

            <div className="pt-2">
              <LocationSelector
                value={location}
                onChange={setLocation}
                label={`Location ng ${selectedRole === 'seller' ? 'tindahan' : 'bahay'}`}
                compact
              />
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            {info && <p className="text-brand-600 text-sm bg-brand-50 px-4 py-2 rounded-lg">{info}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {submitting ? 'Naglo-load...' : 'Gumawa ng Account'}
            </button>
          </form>
        </div>
      )}

      {/* Verify Email */}
      {mode === 'verify-email' && (
        <div className="flex-1 px-5 flex flex-col">
          <div className="flex justify-center mb-6 mt-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
              <Mail size={32} className="text-brand-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">I-verify ang Email</h2>
          <p className="text-gray-500 text-center mb-6">
            Nagpadala kami ng verification code sa <strong>{email}</strong>. I-check ang inbox at spam folder.
          </p>
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Verification Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000"
                required
                maxLength={8}
                inputMode="numeric"
                className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-center text-2xl font-bold tracking-[0.4em]"
              />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            {info && <p className="text-brand-600 text-sm bg-brand-50 px-4 py-2 rounded-lg">{info}</p>}
            <button
              type="submit"
              disabled={submitting || otpCode.length < 6}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {submitting ? 'Nagve-verify...' : 'I-verify ang Email'}
            </button>
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendCooldown > 0}
              className="w-full py-3 text-brand-600 font-medium text-sm disabled:text-gray-400"
            >
              {resendCooldown > 0 ? `Magpadala ulit sa ${resendCooldown}s` : 'Magpadala ulit ng code'}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
            <ShieldCheck size={18} />
            <span>Para sa seguridad ng iyong account</span>
          </div>
        </div>
      )}
    </div>
  );
}
