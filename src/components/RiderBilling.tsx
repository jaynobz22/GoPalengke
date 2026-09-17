import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { RiderFee, RiderFeePayment, Order } from '@/lib/types';
import {
  RIDER_FEE_THRESHOLD, RIDER_FEE_WARNING_80, RIDER_FEE_WARNING_90,
  RIDER_ONBOARDING_FEE, RIDER_ONBOARDING_ACTIVATION_THRESHOLD,
  RIDER_PLATFORM_FEE_RATE,
} from '@/lib/types';
import { ImageUploadField } from '@/components/ImageUploadField';
import {
  Wallet, TrendingUp, Loader2, Check, X, QrCode, AlertCircle,
  Receipt, ListOrdered, Bike, DollarSign, Info, Upload,
} from 'lucide-react';

type BillingTab = 'summary' | 'transactions' | 'payments';

interface DeliveryTransaction {
  order: Order;
  deliveryFee: number;
  platformFee: number;
  date: string;
}

export function RiderBilling() {
  const { profile } = useAuth();
  const [fee, setFee] = useState<RiderFee | null>(null);
  const [payments, setPayments] = useState<RiderFeePayment[]>([]);
  const [transactions, setTransactions] = useState<DeliveryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BillingTab>('summary');
  const [showPayModal, setShowPayModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warningShown, setWarningShown] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: feeData }, { data: payData }, { data: activeQr }, { data: orders }] = await Promise.all([
      supabase.from('rider_fees').select('*').eq('rider_id', profile.id).maybeSingle(),
      supabase.from('rider_fee_payments').select('*').eq('rider_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('platform_qr_codes').select('*').eq('is_active', true).maybeSingle(),
      supabase.from('orders').select('id, delivery_fee, status, created_at, store:stores(name)')
        .eq('rider_id', profile.id).eq('status', 'delivered').order('created_at', { ascending: false }),
    ]);

    setFee(feeData as RiderFee | null);
    setPayments((payData || []) as RiderFeePayment[]);
    if (activeQr?.image_url) setQrCodeUrl(activeQr.image_url);

    if (orders) {
      setTransactions(orders.map(o => ({
        order: o as any,
        deliveryFee: Number(o.delivery_fee || 0),
        platformFee: Math.round(Number(o.delivery_fee || 0) * RIDER_PLATFORM_FEE_RATE * 100) / 100,
        date: o.created_at,
      })));
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!profile) return;
    const sub = supabase.channel('rider-billing')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fees', filter: `rider_id=eq.${profile.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fee_payments', filter: `rider_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile, load]);

  // Threshold warnings
  useEffect(() => {
    if (!fee) return;
    const payable = Number(fee.total_payable || 0);
    if (payable >= RIDER_FEE_WARNING_90 && payable < RIDER_FEE_THRESHOLD && !fee.warning_90_sent_at) {
      setWarningShown('Ka-rider, ang iyong naipong platform fee ay ₱450 na. Ito ang huling paalala — mangyaring mag-settle bago umabot ng ₱500 upang maiwasan ang deactivation.');
    } else if (payable >= RIDER_FEE_WARNING_80 && payable < RIDER_FEE_WARNING_90 && !fee.warning_80_sent_at) {
      setWarningShown('Ka-rider, ang iyong naipong platform fee ay ₱400 na. Mangyaring mag-settle bago umabot ng ₱500 upang maiwasan ang deactivation.');
    }
  }, [fee]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setError('Maglagay ng tamang halaga.'); return; }
    if (!referenceNumber.trim()) { setError('Ilagay ang reference number.'); return; }
    setSubmitting(true);
    setError(null);

    // Schedule screenshot deletion after 1 hour
    const deleteAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from('rider_fee_payments').insert({
      rider_id: profile.id,
      amount,
      reference_number: referenceNumber.trim(),
      screenshot_url: screenshotUrl,
      screenshot_delete_at: screenshotUrl ? deleteAt : null,
      status: 'pending',
      fee_type: 'both',
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess('Nai-submit na ang payment mo! Maghihintay ng approval mula sa admin.');
      setShowPayModal(false);
      setReferenceNumber('');
      setPayAmount('');
      setScreenshotUrl(null);
      setTimeout(() => setSuccess(null), 4000);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const platformBalance = Number(fee?.platform_fee_balance || 0);
  const totalPayable = Number(fee?.total_payable || 0);
  const totalEarnings = Number(fee?.total_career_earnings || 0);
  const onboardingStatus = fee?.onboarding_fee_status || 'pending';
  const isFrozen = !!fee?.frozen_at;
  const thresholdProgress = Math.min(100, (totalPayable / RIDER_FEE_THRESHOLD) * 100);
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const onboardingActive = onboardingStatus === 'active';
  const onboardingPaid = onboardingStatus === 'paid';
  const earningsToActivation = Math.max(0, RIDER_ONBOARDING_ACTIVATION_THRESHOLD - totalEarnings);

  return (
    <div className="px-5 py-4 pb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Wallet size={20} className="text-blue-600" /> Billing
      </h2>

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-xl mb-4">
          <Check size={16} /> {success}
        </div>
      )}

      {warningShown && (
        <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{warningShown}</span>
          <button onClick={() => setWarningShown(null)} className="flex-shrink-0 ml-auto">
            <X size={14} className="text-amber-500" />
          </button>
        </div>
      )}

      {isFrozen && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Naka-suspend ang iyong account dahil umabot na ng ₱500 ang naipong platform fee. Magbayad para makapag-deliver ka ulit.</span>
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>May {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''} na naghihintay ng approval ng admin.</span>
        </div>
      )}

      {/* Current Balance Due Card */}
      <div className={`rounded-2xl p-5 mb-4 ${totalPayable >= RIDER_FEE_THRESHOLD ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : totalPayable > 0 ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white' : 'bg-white border border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={20} className={totalPayable > 0 ? 'text-white' : 'text-gray-400'} />
          <span className={`text-sm font-medium ${totalPayable > 0 ? 'text-white/90' : 'text-gray-400'}`}>Kasalukuyang Balanse</span>
        </div>
        <p className={`text-3xl font-bold ${totalPayable > 0 ? 'text-white' : 'text-gray-800'}`}>₱{totalPayable.toFixed(2)}</p>

        {/* Threshold Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs ${totalPayable > 0 ? 'text-white/80' : 'text-gray-400'}`}>Limit: ₱{RIDER_FEE_THRESHOLD}</span>
            <span className={`text-xs font-bold ${totalPayable > 0 ? 'text-white' : 'text-gray-500'}`}>{thresholdProgress.toFixed(0)}%</span>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${totalPayable > 0 ? 'bg-white/20' : 'bg-gray-100'}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                thresholdProgress >= 90 ? 'bg-red-300' :
                thresholdProgress >= 80 ? 'bg-amber-300' :
                'bg-green-300'
              }`}
              style={{ width: `${thresholdProgress}%` }}
            />
          </div>
        </div>

        {totalPayable > 0 && (
          <button
            onClick={() => {
              setPayAmount(totalPayable.toFixed(2));
              setShowPayModal(true);
            }}
            className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2"
          >
            <DollarSign size={16} /> Magbayad Ngayon
          </button>
        )}
        {totalPayable === 0 && (
          <p className="text-xs text-gray-400 mt-2">Wala pang babayaran. Keep delivering!</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          <TrendingUp size={14} /> Buod
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'transactions' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          <ListOrdered size={14} /> Transaksyon
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
          }`}
        >
          <Receipt size={14} /> Bayaran
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <>
          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" />
                <span className="text-sm text-gray-600">3% Platform Fee (naipon)</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">₱{platformBalance.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className={onboardingActive ? 'text-amber-500' : onboardingPaid ? 'text-green-500' : 'text-gray-400'} />
                <span className="text-sm text-gray-600">Onboarding Fee (₱{RIDER_ONBOARDING_FEE})</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">
                {onboardingPaid ? 'Naibayad na' : onboardingActive ? 'Aktibo' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Career Earnings */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bike size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-600">Total Career Earnings</span>
              </div>
              <span className="text-sm font-bold text-gray-800">₱{totalEarnings.toFixed(2)}</span>
            </div>
            {!onboardingPaid && !onboardingActive && (
              <>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (totalEarnings / RIDER_ONBOARDING_ACTIVATION_THRESHOLD) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  ₱{earningsToActivation.toFixed(2)} pa bago ma-activate ang ₱{RIDER_ONBOARDING_FEE} onboarding fee.
                </p>
              </>
            )}
            {onboardingActive && (
              <p className="text-xs text-amber-600 font-medium">Na-activate na ang onboarding fee. Kasama na sa kasalukuyang balanse.</p>
            )}
            {onboardingPaid && (
              <p className="text-xs text-green-600 font-medium">Naibayad na ang onboarding fee.</p>
            )}
          </div>

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
            <p className="text-xs text-blue-700 font-medium mb-2">Paano ito gumagana:</p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• 3% ng bawat delivery fee ang platform fee na naipon</li>
              <li>• Kapag ₱{RIDER_FEE_THRESHOLD} na ang naipon, maa-suspend ang account hanggang magbayad</li>
              <li>• ₱{RIDER_ONBOARDING_FEE} onboarding fee — pwedeng bayaran agad o hihintayin hanggang ₱{RIDER_ONBOARDING_ACTIVATION_THRESHOLD} earnings</li>
              <li>• Magbayad gamit ang QR code ng admin, ilagay ang reference number, at maghintay ng approval</li>
            </ul>
          </div>
        </>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <ListOrdered size={16} /> Kasaysayan ng Deliveries
            </h3>
            <span className="text-xs text-gray-400">{transactions.length} delivery{transactions.length !== 1 ? 's' : ''}</span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Bike size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Wala pang completed delivery.</p>
              <p className="text-xs text-gray-300 mt-1">Makikita rito ang bawat delivery na nag-ambag sa 3% platform fee mo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700">Kabuuang Platform Fee</span>
                <span className="font-bold text-sm text-blue-700">₱{transactions.reduce((s, t) => s + t.platformFee, 0).toFixed(2)}</span>
              </div>

              {transactions.map(t => (
                <div key={t.order.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Bike size={14} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          {(t.order as any).store?.name || 'Tindahan'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">-₱{t.platformFee.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">3% ng ₱{t.deliveryFee.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Naihatid</span>
                    <span className="text-gray-400">#{t.order.id.slice(0, 8)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div>
          <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <Receipt size={16} /> Kasaysayan ng Bayaran
          </h3>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Wala pang payment history.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-800">₱{Number(p.amount || 0).toFixed(2)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'approved' ? 'bg-green-100 text-green-700' :
                      p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.status === 'approved' ? 'Na-aprubahan' : p.status === 'pending' ? 'Naghihintay' : 'Hindi na-aprubahan'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Ref: {p.reference_number}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Magbayad</h3>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {qrCodeUrl ? (
              <div className="flex flex-col items-center mb-4">
                <div className="w-48 h-48 bg-gray-100 rounded-2xl overflow-hidden mb-2">
                  <img src={qrCodeUrl} alt="Admin QR Code" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-gray-400 text-center">I-scan ang QR code gamit ang GCash/Maya at magbayad ng ₱{payAmount}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center mb-4 py-6">
                <QrCode size={48} className="text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 text-center">Wala pang QR code na na-upload ang admin. Makipag-ugnayan sa admin.</p>
              </div>
            )}

            <form onSubmit={submitPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Halaga</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Hal. 500"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Ilagay ang reference number mula GCash/Maya"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                  <Upload size={12} /> Receipt Screenshot (opsyonal)
                </label>
                <p className="text-[10px] text-gray-400 mb-2">Awtomatikong mabubura ang screenshot pagkatapos ng 1 oras o kapag na-aprubahan na.</p>
                <ImageUploadField
                  label="Receipt Screenshot"
                  value={screenshotUrl || ''}
                  onChange={(url) => setScreenshotUrl(url || null)}
                  bucket="rider-receipts"
                  folder="payment-screenshots"
                />
              </div>
              {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {submitting ? 'Nagsusumite...' : 'I-submit ang Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
