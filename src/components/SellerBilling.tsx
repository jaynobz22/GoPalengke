import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { SellerFee, FeePayment } from '@/lib/types';
import { COMMISSION_RATE, SUBSCRIPTION_FEE, SUBSCRIPTION_THRESHOLD, PAYMENT_THRESHOLD } from '@/lib/types';
import {
  DollarSign, TrendingUp, Calendar, Loader2, Check, X, QrCode,
  AlertCircle, Wallet, Receipt,
} from 'lucide-react';

export function SellerBilling() {
  const { profile } = useAuth();
  const [fee, setFee] = useState<SellerFee | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: feeData }, { data: payData }, { data: activeQr }] = await Promise.all([
      supabase.from('seller_fees').select('*').eq('seller_id', profile.id).maybeSingle(),
      supabase.from('fee_payments').select('*').eq('seller_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('platform_qr_codes').select('*').eq('is_active', true).maybeSingle(),
    ]);
    setFee(feeData as SellerFee | null);
    setPayments((payData || []) as FeePayment[]);
    if (activeQr?.image_url) setQrCodeUrl(activeQr.image_url);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setError('Maglagay ng tamang halaga.'); return; }
    if (!referenceNumber.trim()) { setError('Ilagay ang reference number.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('fee_payments').insert({
      seller_id: profile.id,
      amount,
      reference_number: referenceNumber.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess('Nai-submit na ang payment! Maghihintay ng approval mula sa admin.');
      setShowPayModal(false);
      setReferenceNumber('');
      setPayAmount('');
      setTimeout(() => setSuccess(null), 4000);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const commissionBalance = fee?.commission_balance || 0;
  const subscriptionBalance = fee?.subscription_balance || 0;
  const totalPayable = fee?.total_payable || 0;
  const totalSales = fee?.total_sales || 0;
  const subscriptionActive = fee?.subscription_active || false;
  const salesProgress = Math.min(100, (totalSales / SUBSCRIPTION_THRESHOLD) * 100);
  const canPay = totalPayable >= PAYMENT_THRESHOLD;
  const pendingPayments = payments.filter(p => p.status === 'pending');

  return (
    <div className="px-5 py-4 pb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Fees at Billing</h2>

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-xl mb-4">
          <Check size={16} /> {success}
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>May {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''} na naghihintay ng approval.</span>
        </div>
      )}

      {/* Total Payable Card */}
      <div className={`rounded-2xl p-5 mb-4 ${canPay ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 'bg-white border border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={20} className={canPay ? 'text-white' : 'text-gray-400'} />
          <span className={`text-sm font-medium ${canPay ? 'text-white/90' : 'text-gray-400'}`}>Total Payable</span>
        </div>
        <p className={`text-3xl font-bold ${canPay ? 'text-white' : 'text-gray-800'}`}>₱{totalPayable.toFixed(2)}</p>
        {canPay && (
          <button
            onClick={() => {
              setPayAmount(totalPayable.toFixed(2));
              setShowPayModal(true);
            }}
            className="w-full mt-4 py-3 bg-white text-red-600 rounded-xl font-bold text-sm active:scale-95 transition"
          >
            Magbayad Ngayon
          </button>
        )}
        {!canPay && totalPayable > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Kailangan maabot ang ₱{PAYMENT_THRESHOLD.toFixed(0)} para makapagbayad. (₱{(PAYMENT_THRESHOLD - totalPayable).toFixed(2)} pa)
          </p>
        )}
        {!canPay && totalPayable === 0 && (
          <p className="text-xs text-gray-400 mt-2">Wala pang babayaran. Keep selling!</p>
        )}
      </div>

      {/* Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-600" />
            <span className="text-sm text-gray-600">3% Commission (naipon)</span>
          </div>
          <span className="font-semibold text-sm text-gray-800">₱{commissionBalance.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-sm text-gray-600">Monthly Subscription</span>
          </div>
          <span className="font-semibold text-sm text-gray-800">₱{subscriptionBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Sales Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Total Sales</span>
          <span className="text-sm font-bold text-gray-800">₱{totalSales.toFixed(2)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${subscriptionActive ? 'bg-green-500' : 'bg-brand-500'}`}
            style={{ width: `${salesProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {subscriptionActive
            ? 'Aktibo na ang monthly subscription (₱499/buwan).'
            : `₱${(SUBSCRIPTION_THRESHOLD - totalSales).toFixed(2)} pa bago ma-activate ang monthly subscription.`
          }
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <p className="text-xs text-blue-700 font-medium mb-2">Paano ito gumagana:</p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>• 3% ng bawat benta ang commission ng platform</li>
          <li>• Kapag ₱{SUBSCRIPTION_THRESHOLD.toFixed(0)} na benta, mag-activate ang ₱{SUBSCRIPTION_FEE}/buwan subscription</li>
          <li>• Kapag ₱{PAYMENT_THRESHOLD.toFixed(0)} na ang total payable, pwede na magbayad</li>
          <li>• I-scan ang QR code ng admin, magbayad, at ilagay ang reference number</li>
        </ul>
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
          <Receipt size={16} /> Kasaysayan ng Bayaran
        </h3>
        {payments.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">Wala pang payment history.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-800">₱{p.amount.toFixed(2)}</span>
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

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
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
                  placeholder="Hal. 1000"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Ilagay ang reference number mula GCash/Maya"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
