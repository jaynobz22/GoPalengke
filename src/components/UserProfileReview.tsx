import { useEffect, useState } from 'react';
import { X, MapPin, Phone, Mail, Calendar, Check, XCircle, ImageIcon, Store as StoreIcon, Bike, Home, IdCard, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Store } from '@/lib/types';

interface Props {
  user: Profile;
  onClose: () => void;
}

function ImagePreview({ url, label, hint }: { url: string | null; label: string; hint?: string }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <p className="text-[10px] font-medium text-gray-400 px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span>{label}</span>
          {url ? <span className="text-green-600 flex items-center gap-0.5"><Check size={11} /> May upload</span> : <span className="text-red-500 flex items-center gap-0.5"><XCircle size={11} /> Wala</span>}
        </p>
        {url ? (
          <button onClick={() => setLightbox(true)} className="block w-full relative group">
            <img src={url} alt={label} className="w-full h-32 object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition bg-white/90 text-gray-700 text-[10px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1">
                <ImageIcon size={12} /> I-zoom
              </span>
            </div>
          </button>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-300">
            <ImageIcon size={28} />
          </div>
        )}
        {hint && <p className="text-[10px] text-gray-400 px-3 py-1.5">{hint}</p>}
      </div>
      {lightbox && url && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <X size={24} className="text-white" />
          </button>
          <img src={url} alt={label} className="max-w-full max-h-[90vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-xs font-medium text-gray-700 break-words">{value || <span className="text-gray-300 italic">Wala</span>}</p>
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
      {ok ? <Check size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

export function UserProfileReview({ user, onClose }: Props) {
  const [store, setStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  useEffect(() => {
    if (user.role !== 'seller') return;
    setLoadingStore(true);
    supabase.from('stores').select('*').eq('seller_id', user.id).maybeSingle().then(({ data }) => {
      setStore(data as Store | null);
      setLoadingStore(false);
    });
  }, [user.id, user.role]);

  const fullName = user.full_name || 'Unknown';
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={fullName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-brand-600 font-bold text-lg">{initial}</span>
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-gray-800">{fullName}</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Role + Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-brand-50 text-brand-700 capitalize">{user.role}</span>
            <StatusBadge ok={user.is_approved} label="Approved" />
            <StatusBadge ok={user.is_active} label="Active" />
            <StatusBadge ok={user.email_verified} label="Email Verified" />
            <StatusBadge ok={user.phone_verified} label="Phone Verified" />
          </div>

          {/* Contact info */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <InfoRow icon={<Phone size={14} />} label="Phone" value={user.phone} />
            <InfoRow icon={<Mail size={14} />} label="Email" value={user.email} />
            <InfoRow icon={<Calendar size={14} />} label="Registered" value={new Date(user.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })} />
          </div>

          {/* Address info */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1"><MapPin size={12} /> Address</p>
            <InfoRow icon={<Home size={14} />} label="Complete Address" value={user.complete_address} />
            <div className="flex gap-4 px-5">
              <div className="flex-1">
                <p className="text-[10px] text-gray-400">Barangay</p>
                <p className="text-xs font-medium text-gray-700">{user.barangay || <span className="text-gray-300 italic">Wala</span>}</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400">City</p>
                <p className="text-xs font-medium text-gray-700">{user.city || <span className="text-gray-300 italic">Wala</span>}</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400">Region</p>
                <p className="text-xs font-medium text-gray-700">{user.region || <span className="text-gray-300 italic">Wala</span>}</p>
              </div>
            </div>
          </div>

          {/* Profile photo — all roles */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Shield size={14} className="text-brand-600" /> Profile Photo Verification
            </p>
            <p className="text-[10px] text-gray-400 mb-2">Dapat malinaw ang mukha sa profile photo. Tingnan kung kita ang face at hindi blurred.</p>
            <ImagePreview url={user.avatar_url} label="Profile Photo" hint="Check: Kita ba ang mukha? Malinaw ba?" />
          </div>

          {/* Buyer-specific: House photo */}
          {user.role === 'buyer' && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Home size={14} className="text-brand-600" /> Buyer Verification Photos
              </p>
              <p className="text-[10px] text-gray-400 mb-2">I-check ang picture ng bahay — dapat makita ang harap ng bahay at ang buyer sa labas.</p>
              <ImagePreview url={user.house_photo_url} label="House Photo" hint="Check: Kita ba ang bahay? Tama ba ang address?" />
            </div>
          )}

          {/* Rider-specific: Valid ID, vehicle details */}
          {user.role === 'rider' && (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Bike size={14} className="text-brand-600" /> Rider Verification
                </p>
                <p className="text-[10px] text-gray-400 mb-2">I-check ang valid ID at vehicle details ng rider. Dapat malinaw ang ID at tama ang plate number.</p>
                <div className="grid grid-cols-1 gap-2">
                  <ImagePreview url={user.rider_valid_id_url} label="Valid ID" hint="Check: Malinaw ba? Tugma ba ang pangalan?" />
                  <ImagePreview url={user.rider_qr_code_url} label="QR Code (GCash)" hint="Check: Tama ba ang QR code para sa payment?" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Vehicle Details</p>
                <div className="grid grid-cols-2 gap-3 px-1">
                  <div>
                    <p className="text-[10px] text-gray-400">Plate Number</p>
                    <p className="text-xs font-medium text-gray-700">{user.rider_plate_number || <span className="text-gray-300 italic">Wala</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Motor Model</p>
                    <p className="text-xs font-medium text-gray-700">{user.rider_motor_model || <span className="text-gray-300 italic">Wala</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Age</p>
                    <p className="text-xs font-medium text-gray-700">{user.rider_age ? user.rider_age + ' years old' : <span className="text-gray-300 italic">Wala</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Family Status</p>
                    <p className="text-xs font-medium text-gray-700">{user.rider_family_status || <span className="text-gray-300 italic">Wala</span>}</p>
                  </div>
                </div>
                <InfoRow icon={<Home size={14} />} label="Residence Address" value={user.rider_residence_address} />
              </div>
            </>
          )}

          {/* Seller-specific: Store info */}
          {user.role === 'seller' && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <StoreIcon size={14} className="text-brand-600" /> Store Verification
              </p>
              <p className="text-[10px] text-gray-400 mb-2">I-check ang store logo at banner. Dapat malinaw at propesyonal ang presentation.</p>

              {loadingStore ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : store ? (
                <>
                  <div className="bg-gray-50 rounded-2xl p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center">
                          <StoreIcon size={18} className="text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{store.name}</p>
                        <p className="text-[10px] text-gray-400">{store.palengke_name || store.barangay}, {store.city}</p>
                      </div>
                      <StatusBadge ok={store.is_verified} label="Verified" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-gray-400">Seller Type</p>
                        <p className="font-medium text-gray-700 capitalize">{store.seller_type || 'Regular'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Farm Type</p>
                        <p className="font-medium text-gray-700 capitalize">{store.farm_type || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Payment</p>
                        <p className="font-medium text-gray-700 uppercase">{store.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Rating</p>
                        <p className="font-medium text-gray-700">{store.rating > 0 ? Number(store.rating).toFixed(1) + ' / 5' : 'No ratings yet'}</p>
                      </div>
                    </div>
                    {store.description && (
                      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">{store.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <ImagePreview url={store.logo_url} label="Store Logo" hint="Check: Malinaw ba? Kita ba ang pangalan?" />
                    <ImagePreview url={store.banner_url} label="Store Banner" hint="Check: Propesyonal ba ang itsura?" />
                    {store.livestock_permit_url && (
                      <ImagePreview url={store.livestock_permit_url} label="Livestock Permit" hint="Check: Tama ba ang permit? Valid pa ba?" />
                    )}
                    <ImagePreview url={store.qr_code_url} label="Store QR Code (GCash)" hint="Check: Tama ba ang QR para sa payment?" />
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700">Wala pang tindahan ang seller na ito.</p>
                </div>
              )}
            </div>
          )}

          {/* Video credits info */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">Video Credits</p>
              <p className="text-sm font-bold text-brand-600">{user.video_credits} credits</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
