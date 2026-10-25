// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { paymentAffiliateShares } from '../lib/adminPaymentShares';

interface Row {
  id: string;
  who: string;
  kind: 'seller' | 'rider';
  amount: number;
  breakdown: string;
  ref: string;
  approvedAt: string;
  affiliateShare: number;
}

/** Collected (approved) payments — the admin's actual income, not receivables. */
export function AdminEarningsLedger() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [sp, rp, tx] = await Promise.all([
      supabase.from('fee_payments').select('*, seller:profiles!fee_payments_seller_id_fkey(full_name)').eq('status', 'approved').order('approved_at', { ascending: false }),
      supabase.from('rider_fee_payments').select('*, rider:profiles!rider_fee_payments_rider_id_fkey(full_name)').eq('status', 'approved').order('approved_at', { ascending: false }),
      supabase.from('affiliate_transactions').select('description, amount, status').eq('status', 'credited').or('description.like.%[fp:%,description.like.%[rfp:%'),
    ]);
    const shares = paymentAffiliateShares(tx.data || []);
    const s: Row[] = (sp.data || []).map((p: any) => ({
      id: p.id, who: p.seller?.full_name || 'Seller', kind: 'seller', amount: Number(p.amount || 0),
      breakdown: `Commission ₱${Number(p.commission_paid || 0).toFixed(2)} + Rent ₱${Number(p.subscription_paid || 0).toFixed(2)}`,
      ref: p.reference_number, approvedAt: p.approved_at || p.updated_at, affiliateShare: shares[`fp:${p.id}`] || 0,
    }));
    const r: Row[] = (rp.data || []).map((p: any) => ({
      id: p.id, who: p.rider?.full_name || 'Rider', kind: 'rider', amount: Number(p.amount || 0),
      breakdown: `Platform fee ₱${Number(p.platform_fee_paid || 0).toFixed(2)} + Onboarding ₱${Number(p.onboarding_fee_paid || 0).toFixed(2)}`,
      ref: p.reference_number, approvedAt: p.approved_at || p.updated_at, affiliateShare: shares[`rfp:${p.id}`] || 0,
    }));
    setRows([...s, ...r].sort((a, b) => (b.approvedAt || '').localeCompare(a.approvedAt || '')));
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-earnings-ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fee_payments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_transactions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const gross = rows.reduce((s, r) => s + r.amount, 0);
  const aff = rows.reduce((s, r) => s + r.affiliateShare, 0);
  const fmt = (d: string) => d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-green-600" />
          <div>
            <p className="text-sm font-bold text-gray-800">Kita ng Admin (Nakolekta na)</p>
            <p className="text-xs text-gray-500">{rows.length} approved na bayad</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-green-700">₱{(gross - aff).toFixed(2)}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      <p className="text-[11px] text-gray-500 mt-2">Kabuuang nakolekta ₱{gross.toFixed(2)} − affiliate share ₱{aff.toFixed(2)} = net ₱{(gross - aff).toFixed(2)}</p>
      {open && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {rows.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Wala pang approved na bayad.</p>}
          {rows.map(r => (
            <div key={r.kind + r.id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 truncate">{r.who} <span className="text-[10px] font-medium text-gray-500 uppercase">{r.kind}</span></p>
                <p className="text-sm font-bold text-gray-800">₱{r.amount.toFixed(2)}</p>
              </div>
              <p className="text-[11px] text-gray-500">{r.breakdown}</p>
              {r.affiliateShare > 0 && <p className="text-[11px] text-orange-600">Affiliate share: −₱{r.affiliateShare.toFixed(2)} · Net: ₱{(r.amount - r.affiliateShare).toFixed(2)}</p>}
              <p className="text-[10px] text-gray-400">{fmt(r.approvedAt)} · Ref {r.ref}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
