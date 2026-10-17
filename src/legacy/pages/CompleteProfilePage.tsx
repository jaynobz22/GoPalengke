// @ts-nocheck
import { useState } from 'react';
import { Check, Bike, Store } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LocationSelector, type LocationData } from '../components/LocationSelector';
import { VEHICLE_TIERS } from '../lib/deliveryFee';

// Shown after a new account is verified but basic details (name/address) are still missing.
export function CompleteProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const isPhoneAccount = (profile?.email || '').endsWith('@phone.gopalengke.net');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [contactEmail, setContactEmail] = useState('');
  const [vehicleType, setVehicleType] = useState(profile?.vehicle_type || 'motorcycle');
  const [location, setLocation] = useState<LocationData>({ barangay: '', district: '', city: '', region: '1300000000' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const role = profile?.role;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError('Ilagay ang buong pangalan.');
    if (!location.city || !location.barangay) return setError('Piliin ang lungsod at barangay.');
    if (!isPhoneAccount && !/^(09|\+639)\d{9}$/.test(phone.replace(/\s/g, ''))) return setError('Ilagay ang tamang cellphone number.');
    setSaving(true);
    const update: any = {
      full_name: fullName.trim(),
      barangay: location.barangay, district: location.district || null, city: location.city, region: location.region,
    };
    if (!isPhoneAccount) update.phone = phone.trim();
    if (role === 'rider') update.vehicle_type = vehicleType;
    const { error: err } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (err) { setSaving(false); return setError(err.message); }
    if (role === 'seller' || role === 'rider') {
      const ref = sessionStorage.getItem('gopalengke_ref_code') || null;
      try {
        await supabase.rpc('link_affiliate_referral', { p_referral_code: ref, p_user_id: profile.id, p_role: role, p_full_name: fullName.trim() });
      } catch { /* best-effort */ }
      sessionStorage.removeItem('gopalengke_ref_code');
    }
    if (isPhoneAccount && role === 'seller') supabase.rpc('send_seller_welcome_message', { p_user_id: profile.id }).then(() => {}, () => {});
    await refreshProfile();
    setSaving(false);
  }

  const input = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition';
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-orange-50 px-5 pt-12 pb-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800">Kumpletuhin ang Profile</h1>
        <p className="text-gray-500 text-sm mb-6">Verified na ang account mo! Ilang detalye na lang para makapagsimula.</p>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Buong Pangalan</label>
            <input className={input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan dela Cruz" required />
          </div>
          {!isPhoneAccount && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Cellphone Number</label>
              <input className={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09171234567" required />
            </div>
          )}
          {role === 'rider' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">Klase ng Sasakyan</label>
              {VEHICLE_TIERS.map(vt => {
                const sel = vehicleType === vt.id;
                const Icon = vt.id === 'van' ? Store : Bike;
                return (
                  <button key={vt.id} type="button" onClick={() => setVehicleType(vt.id)}
                    className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 ${sel ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
                    <Icon size={20} className={sel ? 'text-brand-600' : 'text-gray-500'} />
                    <span className="flex-1 text-left text-sm font-semibold text-gray-800">{vt.label} <span className="text-xs text-gray-500 font-normal">· {vt.maxLoadKg}kg</span></span>
                    {sel && <Check size={18} className="text-brand-600" />}
                  </button>
                );
              })}
            </div>
          )}
          <LocationSelector value={location} onChange={setLocation} label={`Location ng ${role === 'seller' ? 'tindahan' : 'bahay'}`} compact />
          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 disabled:opacity-50">
            {saving ? 'Sine-save...' : 'Simulan Gamitin ang GoPalengke'}
          </button>
          <button type="button" onClick={signOut} className="w-full py-2 text-sm text-gray-400">Mag-sign out</button>
        </form>
      </div>
    </div>
  );
}
