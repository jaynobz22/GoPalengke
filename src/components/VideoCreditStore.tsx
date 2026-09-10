import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { compressImage } from '@/lib/imageCompress';
import type { VideoCreditPurchase, CreditPackage } from '@/lib/types';
import { VIDEO_CREDIT_PACKAGES } from '@/lib/types';
import {
  Video, Loader2, X, Check, AlertCircle, QrCode,
  Upload, Coins, Clock, ShoppingCart,
} from 'lucide-react';

export function VideoCreditStore() {
  const { profile, refreshProfile } = useAuth();
  const [purchases, setPurchases] = useState<VideoCreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('video_credit_purchases')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setPurchases((data || []) as VideoCreditPurchase[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  function handleSelectPackage(pkg: CreditPackage) {
    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  }

  function handleSubmitted() {
    setShowPaymentModal(false);
    setSelectedPackage(null);
    setSuccess('Nai-submit na ang iyong payment! Maghihintay ng approval mula sa admin.');
    refreshProfile();
    load();
    setTimeout(() => setSuccess(null), 5000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const credits = profile?.video_credits ?? 0;
  const pendingPurchases = purchases.filter(p => p.status === 'pending');

  return (
    <div className="px-5 py-4 pb-8">
      {/* Credit Balance Header */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 mb-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Coins size={20} className="text-white" />
          <span className="text-sm font-medium text-white/90">Iyong Video Call Credits</span>
        </div>
        <p className="text-4xl font-bold">{credits}</p>
        <p className="text-xs text-white/70 mt-1">
          1 credit = 1 minuto ng video call
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-xl mb-4">
          <Check size={16} /> {success}
        </div>
      )}

      {pendingPurchases.length > 0 && (
        <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>May {pendingPurchases.length} pending purchase{pendingPurchases.length > 1 ? 's' : ''} na naghihintay ng approval.</span>
        </div>
      )}

      {/* Package Cards */}
      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        <ShoppingCart size={16} /> Bumili ng Credits
      </h3>
      <div className="space-y-3">
        {VIDEO_CREDIT_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Video size={22} className="text-brand-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{pkg.credits} Credits</p>
                {pkg.bonus && (
                  <p className="text-xs text-green-600 font-medium">+{pkg.bonus} bonus credits!</p>
                )}
                <p className="text-xs text-gray-400">Tumawag ng {pkg.credits} minuto</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">₱{pkg.price}</p>
              <button
                onClick={() => handleSelectPackage(pkg)}
                className="mt-1 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
              >
                Bumili
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-4">
        <p className="text-xs text-blue-700 font-medium mb-2">Paano bumili:</p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>1. Piliin ang package na gusto mo</li>
          <li>2. I-scan ang GoTyme QR code gamit ang e-wallet app</li>
          <li>3. Magbayad at kumuha ng reference number</li>
          <li>4. I-upload ang screenshot at i-submit para sa approval</li>
          <li>5. Maghintay ng admin approval — idadagdag ang credits sa account mo</li>
        </ul>
      </div>

      {/* Purchase History */}
      {purchases.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Kasaysayan ng Pagbili</h3>
          <div className="space-y-2">
            {purchases.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{p.credits} credits — ₱{p.amount_paid}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  p.status === 'approved' ? 'bg-green-100 text-green-700' :
                  p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {p.status === 'approved' ? 'Na-approve' :
                   p.status === 'rejected' ? 'Na-reject' :
                   'Naghihintay'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPackage && (
        <PaymentModal
          pkg={selectedPackage}
          onClose={() => { setShowPaymentModal(false); setSelectedPackage(null); }}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}

// ============= PAYMENT MODAL =============
function PaymentModal({
  pkg,
  onClose,
  onSubmitted,
}: {
  pkg: CreditPackage;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { profile } = useAuth();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop() || 'webp';
      const fileName = `payments/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(fileName, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(fileName);
      setScreenshotUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Hindi ma-upload ang larawan.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!referenceNumber.trim()) { setError('Ilagay ang payment reference number.'); return; }
    if (!screenshotUrl) { setError('Mag-upload ng screenshot ng payment.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('video_credit_purchases').insert({
      user_id: profile.id,
      credits: pkg.credits,
      amount_paid: pkg.price,
      reference_number: referenceNumber.trim(),
      screenshot_url: screenshotUrl,
      status: 'pending',
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      onSubmitted();
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center px-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="font-bold text-gray-800">Bumili ng {pkg.credits} Credits</h2>
          <button onClick={onClose} className="p-1 -mr-1">
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* QR Code Placeholder */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Mag-scan gamit ang inyong e-wallet app upang magbayad sa GoTyme QR Code na ito.
            </p>
            <div className="w-48 h-48 mx-auto bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center">
              <QrCode size={64} className="text-gray-300" />
              <p className="text-xs text-gray-400 mt-2">QR Code dito</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">Palitan ang placeholder ng totoong GoTyme QR code</p>
          </div>

          {/* Amount to Pay */}
          <div className="bg-brand-50 rounded-xl p-3 text-center">
            <p className="text-xs text-brand-600 font-medium">Bayaran</p>
            <p className="text-2xl font-bold text-brand-700">₱{pkg.price}</p>
          </div>

          {/* Reference Number */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              Payment Reference Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Ilagay ang reference number mula sa e-wallet"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              Screenshot ng Payment
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {screenshotUrl ? (
              <div className="relative">
                <img src={screenshotUrl} alt="Payment screenshot" className="w-full h-40 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setScreenshotUrl('')}
                  className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <X size={14} /> Palitan
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-40 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 active:scale-[0.98] transition disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 size={28} className="animate-spin" /><span className="text-sm">Nag-uupload...</span></>
                ) : (
                  <><Upload size={28} /><span className="text-sm">Mag-upload ng screenshot</span></>
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Nagse-submit...</>
            ) : (
              <>I-submit para sa Approval ng Admin</>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            <Clock size={12} className="inline mr-1" />
            Ma-aapprove ng admin sa loob ng 24 oras
          </p>
        </form>
      </div>
    </div>
  );
}
