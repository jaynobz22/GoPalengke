// @ts-nocheck
import { useState } from 'react';
import { Check, Bike, Store } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LocationSelector, type LocationData } from '../components/LocationSelector';
import { ImageUploadField } from '../components/ImageUploadField';
import { VEHICLE_TIERS } from '../lib/deliveryFee';

export { needsProfileCompletion } from '../lib/profileCompletion';

// Ipinapakita pagkatapos ma-verify ang account hangga't hindi kumpleto ang profile.
export function CompleteProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const isPhoneAccount = (profile?.email || '').endsWith('@phone.gopalengke.net');
  const role = profile?.role;
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [vehicleType, setVehicleType] = useState(profile?.vehicle_type || 'motorcycle');
  const [location, setLocation] = useState<LocationData>({
    barangay: profile?.barangay || '', district: profile?.district || '', city: profile?.city || '', region: profile?.region || '1300000000',
  });
  const [avatar, setAvatar] = useState(profile?.avatar_url || '');
  const [housePhoto, setHousePhoto] = useState(profile?.house_photo_url || '');
  const [address, setAddress] = useState(profile?.complete_address || profile?.rider_residence_address || '');
  const [age, setAge] = useState(profile?.rider_age?.toString() || '');
  const [family, setFamily] = useState(profile?.rider_family_status || '');
  const [plate, setPlate] = useState(profile?.rider_plate_number || '');
  const [model, setModel] = useState(profile?.rider_motor_model || '');
  const [license, setLicense] = useState(profile?.rider_valid_id_url || '');
  const [orcr, setOrcr] = useState(profile?.rider_lto_or_cr_url || '');
  const [riderQr, setRiderQr] = useState(profile?.rider_qr_code_url || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError('Ilagay ang buong pangalan.');
    if (!avatar) return setError('Mag-upload ng profile picture.');
    if (!location.city || !location.barangay) return setError('Piliin ang lungsod at barangay.');
    if (address.trim().length < 5) return setError('Ilagay ang kumpletong address (house no., street, purok).');
    if (!isPhoneAccount && !/^(09|\+639)\d{9}$/.test(phone.replace(/\s/g, ''))) return setError('Ilagay ang tamang cellphone number.');
    if (role === 'buyer' && !housePhoto) return setError('Mag-upload ng larawan ng bahay para madaling mahanap ng rider.');
    if (role === 'rider') {
      const n = parseInt(age);
      if (!n || n < 18 || n > 80) return setError('Ilagay ang tamang edad (18 pataas).');
      if (!family.trim()) return setError('Ilagay ang family status.');
      if (!plate.trim()) return setError('Ilagay ang plate number.');
      if (!model.trim()) return setError('Ilagay ang model ng sasakyan.');
      if (!license) return setError("Mag-upload ng Driver's License.");
      if (!orcr) return setError('Mag-upload ng LTO OR/CR.');
      if (!riderQr) return setError('Mag-upload ng QR code (GCash/Maya) para sa delivery fee.');
    }
    setSaving(true);
    const update: any = {
      full_name: fullName.trim(),
      avatar_url: avatar,
      barangay: location.barangay, district: location.district || null, city: location.city, region: location.region,
      complete_address: address.trim(),
    };
    if (!isPhoneAccount) update.phone = phone.trim();
    if (role === 'buyer') update.house_photo_url = housePhoto;
    if (role === 'rider') Object.assign(update, {
      vehicle_type: vehicleType, rider_age: parseInt(age), rider_family_status: family.trim(),
      rider_residence_address: address.trim(), rider_plate_number: plate.trim(), rider_motor_model: model.trim(),
      rider_valid_id_url: license, rider_lto_or_cr_url: orcr, rider_qr_code_url: riderQr,
    });
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
  const label = 'text-sm font-medium text-gray-600 mb-1 block';
  const card = 'bg-white rounded-2xl border border-gray-100 p-4 space-y-4';
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-orange-50 px-5 pt-12 pb-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800">Kumpletuhin ang Profile</h1>
        <p className="text-gray-500 text-sm mb-6">
          Verified na ang account mo! Kumpletuhin muna ang mga detalye bago makapasok sa dashboard
          {role === 'rider' ? ' — kailangan ito para ma-verify ka bilang rider.' : '.'}
        </p>
        <form onSubmit={save} className="space-y-4">
          <div className={card}>
            <p className="font-semibold text-gray-800">Personal na Detalye</p>
            <ImageUploadField label="Profile Picture (malinaw na mukha)" value={avatar} onChange={setAvatar}
              bucket="profile-images" folder={`avatars/${profile?.id}`} aspectClass="aspect-square max-w-40 mx-auto" cropAspect={1} />
            <div>
              <label className={label}>Buong Pangalan</label>
              <input className={input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan dela Cruz" required />
            </div>
            {!isPhoneAccount && (
              <div>
                <label className={label}>Cellphone Number</label>
                <input className={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09171234567" required />
              </div>
            )}
            {role === 'rider' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Edad</label>
                  <input className={input} type="number" inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="25" />
                </div>
                <div>
                  <label className={label}>Family Status</label>
                  <select className={input} value={family} onChange={e => setFamily(e.target.value)}>
                    <option value="">Piliin</option>
                    <option value="Single">Single</option>
                    <option value="May asawa">May asawa</option>
                    <option value="May asawa at anak">May asawa at anak</option>
                    <option value="Single parent">Single parent</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className={card}>
            <p className="font-semibold text-gray-800">{role === 'seller' ? 'Location ng Tindahan' : 'Tirahan'}</p>
            <LocationSelector value={location} onChange={setLocation} label={role === 'seller' ? 'Location ng tindahan' : 'Lungsod at barangay'} compact />
            <div>
              <label className={label}>Kumpletong Address</label>
              <textarea className={input} rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="House no., street, purok/subdivision, landmark" />
            </div>
            {role === 'buyer' && (
              <ImageUploadField label="Larawan ng Bahay" value={housePhoto} onChange={setHousePhoto}
                bucket="profile-images" folder={`houses/${profile?.id}`} hint="Para madaling mahanap ng rider ang bahay mo." />
            )}
          </div>

          {role === 'rider' && (
            <div className={card}>
              <p className="font-semibold text-gray-800">Sasakyan at Dokumento</p>
              <div className="space-y-2">
                {VEHICLE_TIERS.map(vt => {
                  const sel = vehicleType === vt.id;
                  const Icon = vt.id === 'minivan' ? Store : Bike;
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Plate Number</label>
                  <input className={input} value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" />
                </div>
                <div>
                  <label className={label}>Model</label>
                  <input className={input} value={model} onChange={e => setModel(e.target.value)} placeholder="Honda Click 125" />
                </div>
              </div>
              <ImageUploadField label="Driver's License" value={license} onChange={setLicense}
                bucket="profile-images" folder={`valid-ids/${profile?.id}`} objectFit="contain" />
              <ImageUploadField label="LTO OR/CR" value={orcr} onChange={setOrcr}
                bucket="profile-images" folder={`lto-orcr/${profile?.id}`} objectFit="contain" />
              <ImageUploadField label="QR Code (GCash/Maya)" value={riderQr} onChange={setRiderQr}
                bucket="profile-images" folder={`rider-qr/${profile?.id}`} objectFit="contain"
                hint="Para mabayaran ka ng seller ng delivery fee kapag hindi COD ang order." />
            </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving} className="w-full py-3.5 px-3 bg-brand-600 text-white rounded-2xl font-semibold text-sm sm:text-lg leading-tight text-center shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50">
            {saving ? 'Sine-save...' : 'I-save at Simulang Gamitin ang GoPalengke'}
          </button>
          <button type="button" onClick={signOut} className="w-full py-2 text-sm text-gray-400">Mag-sign out</button>
        </form>
      </div>
    </div>
  );
}
