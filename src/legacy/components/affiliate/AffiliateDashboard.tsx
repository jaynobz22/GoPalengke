// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { useAffiliateAuth, type Affiliate } from '../../lib/affiliateAuth';
import { navigate } from '../../lib/router';
import { supabase } from '../../lib/supabase';
import { AffiliateMarketingTools } from '../../components/affiliate/AffiliateMarketingTools';
import { AIMarketingKit } from '../../components/affiliate/AIMarketingKit';
import { TargetedMarketingPages } from '../../components/affiliate/TargetedMarketingPages';
import {
  Wallet, TrendingUp, Store, Bike, Copy, CheckCheck, LogOut, ArrowLeft,
  Link as LinkIcon, Loader2, Receipt, Target, Users, RefreshCw, Download,
  ChevronRight, QrCode, AlertCircle, Megaphone,
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
  tier: number;
  created_at: string;
}

const SELLER_MILESTONE = 1000;
const SELLER_COMMISSION_TOTAL = 200;
const SELLER_TIER1 = 150;
const SELLER_TIER2 = 50;
const RIDER_MILESTONE = 500;
const RIDER_COMMISSION_TOTAL = 50;
const RIDER_TIER1 = 35;
const RIDER_TIER2 = 15;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'history' | 'marketing'>('overview');
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

  function copyLink() {
    if (!affiliate) return;
    const link = `${window.location.origin}/?ref=${affiliate.referral_code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink('link');
      setTimeout(() => setCopiedLink(null), 2000);
    });
  }

  if (!affiliate) return null;

  const sellerRefs = referrals.filter(r => r.referred_role === 'seller');
  const riderRefs = referrals.filter(r => r.referred_role === 'rider');
  const totalReferrals = referrals.length;
  const lifetimeEarnings = Number(affiliate.lifetime_earnings) || 0;
  const walletBalance = Number(affiliate.wallet_balance) || 0;
  const tier1Earnings = Number(affiliate.tier1_earnings) || 0;
  const tier2Earnings = Number(affiliate.tier2_earnings) || 0;

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
        <div className="grid grid-cols-4 sm:flex sm:justify-around gap-2 mt-4 bg-white rounded-2xl border border-gray-100 p-1.5 shadow-sm">
          {[
            { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
            { id: 'milestones' as const, label: 'Milestones', icon: Target },
            { id: 'history' as const, label: 'History', icon: Receipt },
            { id: 'marketing' as const, label: 'Marketing', icon: Megaphone },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-medium transition ${
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

                {/* 2-Tier Earnings Breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-brand-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Kita Breakdown (2-Tier)</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-green-50 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-semibold text-green-800">Direktang Kita (Tier 1)</p>
                        <p className="text-xs text-gray-500">Kita mula sa mga direktang referrals mo</p>
                      </div>
                      <p className="text-lg font-bold text-green-700">₱{tier1Earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex items-center justify-between bg-blue-50 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Kita sa 2nd Level Affiliates (Tier 2)</p>
                        <p className="text-xs text-gray-500">Override mula sa mga na-invite ng mga na-invite mo</p>
                      </div>
                      <p className="text-lg font-bold text-blue-700">₱{tier2Earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-700">Kabuuang Kita</p>
                      <p className="text-lg font-bold text-gray-800">₱{(tier1Earnings + tier2Earnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {/* Invite Link */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <LinkIcon size={18} className="text-brand-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Your Referral Link</h2>
                  </div>

                  <div className="bg-brand-50 rounded-xl p-3 border border-brand-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-brand-600" />
                      <span className="text-sm font-semibold text-gray-700">Referral Link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 overflow-hidden">
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {baseUrl}/?ref={affiliate.referral_code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyLink()}
                        className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center active:scale-90 transition"
                      >
                        {copiedLink === 'link' ? <CheckCheck size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      I-share ang link na ito sa mga taong gusto mong mag-sign up sa GoPalengke. Sila na ang pipili kung seller o rider ang role nila sa sign up page. Awtomatikong mai-credit sa'yo ang commission kapag naabot nila ang milestone.
                    </p>
                  </div>

                  <div className="mt-3 bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Referral Code:</span>
                    <span className="text-sm font-mono font-bold text-gray-700">{affiliate.referral_code}</span>
                  </div>
                </div>

                {/* Affiliate Invite Link (Tier 2) */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={18} className="text-blue-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Affiliate Invite Link (Tier 2)</h2>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-blue-600" />
                      <span className="text-sm font-semibold text-gray-700">Invite Other Affiliates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200 overflow-hidden">
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {baseUrl}/affiliate?aff_ref={affiliate.referral_code}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const link = `${baseUrl}/affiliate?aff_ref=${affiliate.referral_code}`;
                          navigator.clipboard.writeText(link).then(() => {
                            setCopiedLink('aff_link');
                            setTimeout(() => setCopiedLink(null), 2000);
                          });
                        }}
                        className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center active:scale-90 transition"
                      >
                        {copiedLink === 'aff_link' ? <CheckCheck size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      I-share ang link na ito para mag-invite ng iba pang affiliates. Kapag nag-sign up sila bilang affiliate gamit ang link mo, awtomatikong ikaw ang kanilang sponsor. Makakakuha ka ng Tier 2 override commission (₱{SELLER_TIER2} kada seller milestone, ₱{RIDER_TIER2} kada rider milestone) mula sa mga referrals nila.
                    </p>
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
                                ? `₱${remaining.toFixed(0)} pa bago maabot ang next milestone (₱${SELLER_TIER1} sa'yo + ₱${SELLER_TIER2} sa sponsor)`
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
                                ? `₱${remaining.toFixed(0)} pa bago maabot ang next milestone (₱${RIDER_TIER1} sa'yo + ₱${RIDER_TIER2} sa sponsor)`
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
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800 leading-snug">{tx.description}</p>
                              {tx.tier === 2 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex-shrink-0">Tier 2</span>
                              )}
                              {tx.tier === 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex-shrink-0">Tier 1</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-bold ${tx.type === 'payout' ? 'text-red-600' : tx.tier === 2 ? 'text-blue-600' : 'text-green-600'}`}>
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

            {/* MARKETING TAB */}
            {activeTab === 'marketing' && (
              <div className="space-y-4">
                <TargetedMarketingPages affiliate={affiliate} />
                <AIMarketingKit affiliate={affiliate} />
                <AffiliateMarketingTools affiliate={affiliate} />
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
