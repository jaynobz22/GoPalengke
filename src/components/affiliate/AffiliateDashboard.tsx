import { useState, useEffect, useCallback } from 'react';
import { useAffiliateAuth, type Affiliate } from '@/lib/affiliateAuth';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import {
  Wallet, TrendingUp, Store, Bike, Copy, CheckCheck, LogOut, ArrowLeft,
  Link as LinkIcon, Loader2, Receipt, Target, Users, RefreshCw, Download,
  ChevronRight, QrCode, AlertCircle,
} from 'lucide-react';

interface Referral {
  id: string;
  referred_name: string;
  referred_role: string;
  accumulated_admin_collected: number;
  milestones_hit: number;
  total_commission_earned: number;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
}

const SELLER_MILESTONE = 1000;
const SELLER_COMMISSION = 200;
const RIDER_MILESTONE = 500;
const RIDER_COMMISSION = 50;
const PAYOUT_MINIMUM = 1000;

async function requestPayout(affiliateId: string, walletBalance: number): Promise<{ error: string | null }> {
  if (walletBalance < PAYOUT_MINIMUM) {
    return { error: `Dapat maabot ang ₱${PAYOUT_MINIMUM} wallet balance bago mag-request ng payout.` };
  }
  const { error } = await supabase
    .from('affiliates')
    .update({ payout_status: 'requested', payout_requested_at: new Date().toISOString() })
    .eq('id', affiliateId);
  if (error) return { error: error.message };
  return { error: null };
}

export function AffiliateDashboard() {
  const { affiliate, signOut, refresh } = useAffiliateAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'history'>('overview');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!affiliate) return;
    const [refData, txData] = await Promise.all([
      supabase.from('affiliate_referrals')
        .select('*')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false }),
      supabase.from('affiliate_transactions')
        .select('*')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false }),
    ]);
    setReferrals((refData.data || []) as Referral[]);
    setTransactions((txData.data || []) as Transaction[]);
    setLoading(false);
  }, [affiliate]);

  useEffect(() => { load(); }, [load]);

  // Auto-seed demo data if none exists
  useEffect(() => {
    if (!affiliate || loading) return;
    if (referrals.length === 0 && transactions.length === 0) {
      seedDemoData(affiliate);
    }
  }, [affiliate, loading, referrals.length, transactions.length]);

  async function seedDemoData(aff: Affiliate) {
    const sellerNames = ['Juan Dela Cruz', 'Maria Santos', 'Pedro Reyes', 'Ana Lim'];
    const riderNames = ['Carlos Garcia', 'Rosa Flores', 'Miguel Torres'];

    const sellerRefs = sellerNames.map((name, i) => ({
      affiliate_id: aff.id,
      referred_role: 'seller',
      referred_name: name,
      accumulated_admin_collected: [650, 1200, 320, 880][i],
      milestones_hit: [0, 1, 0, 0][i],
      total_commission_earned: [0, 200, 0, 0][i],
    }));

    const riderRefs = riderNames.map((name, i) => ({
      affiliate_id: aff.id,
      referred_role: 'rider',
      referred_name: name,
      accumulated_admin_collected: [250, 550, 180][i],
      milestones_hit: [0, 1, 0][i],
      total_commission_earned: [0, 50, 0][i],
    }));

    const { data: insertedRefs } = await supabase.from('affiliate_referrals')
      .insert([...sellerRefs, ...riderRefs])
      .select('*');

    // Seed transactions
    const txs = [
      { affiliate_id: aff.id, type: 'seller_milestone', description: 'Commission from Seller Maria Santos - Milestone Completed', amount: 200, status: 'credited' },
      { affiliate_id: aff.id, type: 'rider_milestone', description: 'Commission from Rider Rosa Flores - Milestone Completed', amount: 50, status: 'credited' },
    ];
    await supabase.from('affiliate_transactions').insert(txs);

    // Update wallet
    await supabase.from('affiliates')
      .update({ wallet_balance: 250, lifetime_earnings: 250 })
      .eq('id', aff.id);

    refresh();
    load();
  }

  function copyLink(type: 'seller' | 'rider') {
    if (!affiliate) return;
    const link = `${window.location.origin}/?ref=${affiliate.referral_code}&type=${type}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  }

  if (!affiliate) return null;

  const sellerRefs = referrals.filter(r => r.referred_role === 'seller');
  const riderRefs = referrals.filter(r => r.referred_role === 'rider');
  const totalReferrals = referrals.length;
  const lifetimeEarnings = Number(affiliate.lifetime_earnings) || 0;
  const walletBalance = Number(affiliate.wallet_balance) || 0;

  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 text-white">
        <div className="max-w-5xl mx-auto px-5 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate('/affiliate')} className="flex items-center gap-2 text-white/80 text-sm hover:text-white transition">
              <ArrowLeft size={18} /> Affiliate Home
            </button>
            <button
              onClick={() => { signOut(); navigate('/affiliate'); }}
              className="flex items-center gap-1.5 text-white/80 text-sm hover:text-white transition"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Wallet size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Affiliate Dashboard</h1>
              <p className="text-green-100 text-sm">Welcome, {affiliate.full_name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex gap-1 mt-4 bg-white rounded-2xl border border-gray-100 p-1 shadow-sm">
          {[
            { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
            { id: 'milestones' as const, label: 'Milestones', icon: Target },
            { id: 'history' as const, label: 'History', icon: Receipt },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  activeTab === t.id ? 'bg-brand-600 text-white' : 'text-gray-500'
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-brand-500" />
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={Wallet}
                    label="Wallet Balance"
                    value={`₱${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="from-green-500 to-emerald-600"
                    subtitle="Available for Payout"
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Lifetime Earnings"
                    value={`₱${lifetimeEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    color="from-blue-500 to-cyan-600"
                    subtitle="Accumulated Total"
                  />
                  <MetricCard
                    icon={Store}
                    label="Referred Sellers"
                    value={String(sellerRefs.length)}
                    color="from-orange-500 to-amber-500"
                    subtitle="Active Sellers"
                  />
                  <MetricCard
                    icon={Bike}
                    label="Referred Riders"
                    value={String(riderRefs.length)}
                    color="from-purple-500 to-indigo-500"
                    subtitle="Active Riders"
                  />
                </div>

                {/* Invite Links */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <LinkIcon size={18} className="text-brand-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Your Referral Links</h2>
                  </div>

                  <div className="space-y-3">
                    {/* Seller Link */}
                    <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={16} className="text-orange-600" />
                        <span className="text-sm font-semibold text-gray-700">Seller Referral Link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 overflow-hidden">
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {baseUrl}/?ref={affiliate.referral_code}&type=seller
                          </p>
                        </div>
                        <button
                          onClick={() => copyLink('seller')}
                          className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500 text-white flex items-center justify-center active:scale-90 transition"
                        >
                          {copiedLink === 'seller' ? <CheckCheck size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Rider Link */}
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Bike size={16} className="text-blue-600" />
                        <span className="text-sm font-semibold text-gray-700">Rider Referral Link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 overflow-hidden">
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {baseUrl}/?ref={affiliate.referral_code}&type=rider
                          </p>
                        </div>
                        <button
                          onClick={() => copyLink('rider')}
                          className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center active:scale-90 transition"
                        >
                          {copiedLink === 'rider' ? <CheckCheck size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Referral Code:</span>
                    <span className="text-sm font-mono font-bold text-gray-700">{affiliate.referral_code}</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={18} className="text-brand-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Referral Summary</h2>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">Total Referrals</span>
                      <span className="text-sm font-bold text-gray-800">{totalReferrals}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">Seller Milestones Hit</span>
                      <span className="text-sm font-bold text-orange-600">{sellerRefs.reduce((s, r) => s + r.milestones_hit, 0)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Rider Milestones Hit</span>
                      <span className="text-sm font-bold text-blue-600">{riderRefs.reduce((s, r) => s + r.milestones_hit, 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Payout QR Code */}
                {affiliate.payout_qr_url && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <QrCode size={18} className="text-brand-600" />
                      <h2 className="font-bold text-gray-800 text-sm">Your Payout QR Code</h2>
                    </div>
                    <div className="flex justify-center">
                      <img src={affiliate.payout_qr_url} alt="Payout QR" className="w-40 h-40 rounded-xl object-cover border border-gray-100" />
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">Ito ang QR code na gagamitin ng admin para magpadala ng payout sa'yo.</p>
                  </div>
                )}
              </div>
            )}

            {/* MILESTONES TAB */}
            {activeTab === 'milestones' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">Milestone Tracker</h2>
                  <button onClick={() => load()} className="flex items-center gap-1.5 text-xs text-gray-500 active:scale-95">
                    <RefreshCw size={14} /> Refresh
                  </button>
                </div>

                {/* Seller Milestones */}
                <div>
                  <h3 className="text-sm font-bold text-orange-600 mb-2 flex items-center gap-1.5">
                    <Store size={16} /> Seller Referrals
                  </h3>
                  {sellerRefs.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6 bg-white rounded-2xl border border-gray-100">Wala pang seller referrals.</p>
                  ) : (
                    <div className="space-y-2">
                      {sellerRefs.map(r => {
                        const progress = Math.min(100, (Number(r.accumulated_admin_collected) / SELLER_MILESTONE) * 100);
                        const remaining = Math.max(0, SELLER_MILESTONE - Number(r.accumulated_admin_collected));
                        return (
                          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm text-gray-800">{r.referred_name}</p>
                                <p className="text-xs text-gray-400">Milestones: {r.milestones_hit} · Earned: ₱{Number(r.total_commission_earned).toFixed(0)}</p>
                              </div>
                              <span className="text-xs font-bold text-gray-600">
                                ₱{Number(r.accumulated_admin_collected).toFixed(0)} / ₱{SELLER_MILESTONE}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {remaining > 0
                                ? `₱${remaining.toFixed(0)} pa bago maabot ang next milestone (₱${SELLER_COMMISSION} sa'yo)`
                                : 'Milestone reached! Waiting for next cycle.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rider Milestones */}
                <div>
                  <h3 className="text-sm font-bold text-blue-600 mb-2 flex items-center gap-1.5">
                    <Bike size={16} /> Rider Referrals
                  </h3>
                  {riderRefs.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6 bg-white rounded-2xl border border-gray-100">Wala pang rider referrals.</p>
                  ) : (
                    <div className="space-y-2">
                      {riderRefs.map(r => {
                        const progress = Math.min(100, (Number(r.accumulated_admin_collected) / RIDER_MILESTONE) * 100);
                        const remaining = Math.max(0, RIDER_MILESTONE - Number(r.accumulated_admin_collected));
                        return (
                          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm text-gray-800">{r.referred_name}</p>
                                <p className="text-xs text-gray-400">Milestones: {r.milestones_hit} · Earned: ₱{Number(r.total_commission_earned).toFixed(0)}</p>
                              </div>
                              <span className="text-xs font-bold text-gray-600">
                                ₱{Number(r.accumulated_admin_collected).toFixed(0)} / ₱{RIDER_MILESTONE}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {remaining > 0
                                ? `₱${remaining.toFixed(0)} pa bago maabot ang next milestone (₱${RIDER_COMMISSION} sa'yo)`
                                : 'Milestone reached! Waiting for next cycle.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">Transaction & Payout History</h2>
                  <button
                    onClick={async () => {
                      setPayoutMsg(null);
                      setPayoutSubmitting(true);
                      const { error } = await requestPayout(affiliate.id, walletBalance);
                      setPayoutSubmitting(false);
                      if (error) {
                        setPayoutMsg(error);
                      } else {
                        setPayoutMsg('Naipadala na ang payout request! Ipoproseso ng admin sa loob ng 24 oras.');
                        refresh();
                      }
                    }}
                    disabled={payoutSubmitting || affiliate.payout_status === 'requested'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold border border-green-200 active:scale-95 transition disabled:opacity-50"
                  >
                    {payoutSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {affiliate.payout_status === 'requested' ? 'Payout Pending' : 'Request Payout'}
                  </button>
                </div>

                {payoutMsg && (
                  <div className={`flex items-center gap-2 rounded-xl p-3 ${
                    payoutMsg.includes('Naipadala') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <p className="text-sm">{payoutMsg}</p>
                  </div>
                )}
                {walletBalance < PAYOUT_MINIMUM && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      Minimum payout threshold: ₱{PAYOUT_MINIMUM}. Kasalukuyang balance: ₱{walletBalance.toFixed(2)}. Kulang pa ng ₱{(PAYOUT_MINIMUM - walletBalance).toFixed(2)}.
                    </p>
                  </div>
                )}
                {transactions.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <Receipt size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Wala pang transactions.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => (
                      <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{tx.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-bold ${
                              tx.type === 'payout' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {tx.type === 'payout' ? '-' : '+'}₱{Number(tx.amount).toFixed(2)}
                            </p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              tx.status === 'credited' ? 'bg-green-100 text-green-700' :
                              tx.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.status === 'credited' ? 'Credited' : tx.status === 'pending' ? 'Pending' : 'Paid'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, subtitle }: {
  icon: typeof Wallet;
  label: string;
  value: string;
  color: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  );
}
