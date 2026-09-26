// @ts-nocheck
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Announcement, Profile, FeePayment, UserRole, SellerFee, AdminCall, AdminConversation, Store, VideoCreditPurchase, RiderFee, RiderFeePayment } from '../lib/types';
import { SUBSCRIPTION_THRESHOLD } from '../lib/types';
import { ImageUploadField } from '../components/ImageUploadField';
import { SecurityDashboardTab } from '../components/SecurityDashboard';
import { AdminVideoCall } from '../components/AdminVideoCall';
import { AdminChat, getOrCreateAdminConversation } from '../components/AdminChat';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { UserProfileReview } from '../components/UserProfileReview';
import { AdminMarketingMaterials } from '../components/affiliate/AdminMarketingMaterials';
import {
  Megaphone, Plus, Trash2, Power, Check, Loader2, LogOut, Eye,
  Store as StoreIcon, ShoppingBag, Bike, Users, Wallet, Settings,
  AlertCircle, X, UserCheck, UserX, DollarSign, TrendingUp, Receipt,
  Lock, Unlock, Video, MessageCircle, Shield, QrCode, MapPin, Mail, Send, Coins,
  ChevronUp, ChevronDown, BarChart3, PlayCircle, ArrowUp, ArrowDown, Clock,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'geographic' | 'campaigns' | 'messages' | 'fees' | 'rider_fees' | 'announcements' | 'security' | 'video_credits' | 'tutorials' | 'settings' | 'analytics' | 'affiliates' | 'marketing';

export function AdminApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [pendingCreditCount, setPendingCreditCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [pendingFeeCount, setPendingFeeCount] = useState(0);
  const [pendingRiderFeeCount, setPendingRiderFeeCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [activeCall, setActiveCall] = useState<{ roomId: string; isCaller: boolean; callId: string; otherName: string } | null>(null);
  const [activeChat, setActiveChat] = useState<{ conversationId: string; otherName: string; userId: string } | null>(null);

  const loadPendingCreditCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('video_credit_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (!error) setPendingCreditCount(count ?? 0);
  }, []);

  const loadPendingUserCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', false);
    if (!error) setPendingUserCount(count ?? 0);
  }, []);

  const loadPendingFeeCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('fee_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) setPendingFeeCount(count ?? 0);
  }, []);

  const loadPendingRiderFeeCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('rider_fee_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) setPendingRiderFeeCount(count ?? 0);
  }, []);

  const loadUnreadMessageCount = useCallback(async () => {
    if (!profile) return;
    const { count, error } = await supabase
      .from('admin_messages')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .neq('sender_id', profile.id);
    if (!error) setUnreadMessageCount(count ?? 0);
  }, [profile]);

  useEffect(() => {
    loadPendingCreditCount();
    loadPendingUserCount();
    loadPendingFeeCount();
    loadPendingRiderFeeCount();
    loadUnreadMessageCount();

    const channel = supabase
      .channel('admin-tab-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_credit_purchases' }, () => loadPendingCreditCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadPendingUserCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, () => loadPendingFeeCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fee_payments' }, () => loadPendingRiderFeeCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => loadUnreadMessageCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadPendingCreditCount, loadPendingUserCount, loadPendingFeeCount, loadPendingRiderFeeCount, loadUnreadMessageCount]);

  useEffect(() => {
    if (tab === 'messages') loadUnreadMessageCount();
    if (tab === 'users') loadPendingUserCount();
    if (tab === 'fees') loadPendingFeeCount();
    if (tab === 'rider_fees') loadPendingRiderFeeCount();
  }, [tab, loadUnreadMessageCount, loadPendingUserCount, loadPendingFeeCount, loadPendingRiderFeeCount]);

  function startAdminCall(user: Profile) {
    const roomId = `admin-call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    (async () => {
      const { data, error } = await supabase
        .from('admin_calls')
        .insert({
          admin_id: profile!.id,
          target_user_id: user.id,
          room_id: roomId,
          status: 'pending',
        })
        .select('*')
        .single();
      if (error || !data) return;
      setActiveCall({ roomId, isCaller: true, callId: (data as AdminCall).id, otherName: user.full_name });
    })();
  }

  function endAdminCall() {
    setActiveCall(null);
  }

  async function startAdminChat(user: Profile) {
    if (!profile) return;
    const convId = await getOrCreateAdminConversation(profile.id, user.id);
    if (convId) {
      setActiveChat({ conversationId: convId, otherName: user.full_name, userId: user.id });
    }
  }

  function endAdminChat() {
    setActiveChat(null);
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'geographic', label: 'Areas', icon: MapPin },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'fees', label: 'Fees', icon: Wallet },
    { id: 'rider_fees', label: 'Rider Fees', icon: Bike },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'video_credits', label: 'Credits', icon: Coins },
    { id: 'tutorials', label: 'Tutorials', icon: PlayCircle },
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'affiliates', label: 'Affiliates', icon: Users },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between md:px-8">
        <div className="flex items-center gap-3">
          <img src="/images/Copilot_20260907_183703.jpg" alt="GoPalengke" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <p className="font-bold text-lg leading-tight">GoPalengke Admin</p>
            <p className="text-xs text-gray-400">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center active:scale-95 transition"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 overflow-x-auto md:px-4">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          const badgeCount =
            t.id === 'video_credits' ? pendingCreditCount :
            t.id === 'users' ? pendingUserCount :
            t.id === 'fees' ? pendingFeeCount :
            t.id === 'rider_fees' ? pendingRiderFeeCount :
            t.id === 'messages' ? unreadMessageCount : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[80px] flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition ${
                active ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-400'
              }`}
            >
              <span className="relative inline-flex">
                <Icon size={18} />
                {badgeCount > 0 && (
                  <span
                    className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
                    aria-label={`${badgeCount} bagong update sa ${t.label}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <ErrorBoundary><OverviewTab /></ErrorBoundary>}
      {tab === 'users' && <ErrorBoundary><UsersTab onStartCall={startAdminCall} onStartChat={startAdminChat} /></ErrorBoundary>}
      {tab === 'geographic' && <ErrorBoundary><GeographicTab /></ErrorBoundary>}
      {tab === 'campaigns' && <ErrorBoundary><CampaignsTab /></ErrorBoundary>}
      {tab === 'messages' && <ErrorBoundary><AdminMessagesTab onOpenChat={(convId, name, userId) => setActiveChat({ conversationId: convId, otherName: name, userId })} /></ErrorBoundary>}
      {tab === 'fees' && <ErrorBoundary><FeesTab /></ErrorBoundary>}
      {tab === 'rider_fees' && <ErrorBoundary><RiderFeesTab /></ErrorBoundary>}
      {tab === 'announcements' && <ErrorBoundary><AnnouncementsTab /></ErrorBoundary>}
      {tab === 'security' && <ErrorBoundary><SecurityDashboardTab /></ErrorBoundary>}
      {tab === 'video_credits' && <ErrorBoundary><VideoCreditsTab onPendingCountChange={setPendingCreditCount} /></ErrorBoundary>}
      {tab === 'tutorials' && <ErrorBoundary><TutorialsTab /></ErrorBoundary>}
      {tab === 'analytics' && <ErrorBoundary><AnalyticsDashboard /></ErrorBoundary>}
      {tab === 'settings' && <ErrorBoundary><SettingsTab /></ErrorBoundary>}
      {tab === 'affiliates' && <ErrorBoundary><AffiliatesTab /></ErrorBoundary>}
      {tab === 'marketing' && <ErrorBoundary><AdminMarketingMaterials /></ErrorBoundary>}

      {activeChat && profile && (
        <AdminChat
          conversationId={activeChat.conversationId}
          currentUserId={profile.id}
          otherName={activeChat.otherName}
          isAdmin={true}
          onBack={endAdminChat}
          onStartCall={isAdmin => {
            if (!profile) return;
            const roomId = `admin-call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            (async () => {
              const { data, error } = await supabase
                .from('admin_calls')
                .insert({
                  admin_id: profile.id,
                  target_user_id: activeChat.userId,
                  room_id: roomId,
                  status: 'pending',
                })
                .select('*')
                .single();
              if (error || !data) return;
              setActiveCall({ roomId, isCaller: true, callId: (data as AdminCall).id, otherName: activeChat.otherName });
            })();
          }}
        />
      )}

      {activeCall && (
        <AdminVideoCall
          roomId={activeCall.roomId}
          isCaller={activeCall.isCaller}
          otherName={activeCall.otherName}
          callId={activeCall.callId}
          onEnd={endAdminCall}
        />
      )}
    </div>
  );
}

// ============= OVERVIEW =============
function OverviewTab() {
  const [stats, setStats] = useState({
    stores: 0, products: 0, buyers: 0, riders: 0, sellers: 0, orders: 0,
    pendingApprovals: 0, pendingPayments: 0, pendingRiderPayments: 0, frozenSellers: 0, frozenRiders: 0,
    totalCommission: 0, totalSubscription: 0, totalPlatformEarnings: 0, totalRiderFees: 0,
    unverifiedStores: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [stores, products, buyers, riders, sellers, orders, pendingApprovals, pendingPayments, sellerFees, frozenCount, unverifiedStores, pendingRiderPayments, frozenRiderCount, riderFees] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'buyer'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'rider'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('fee_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('seller_fees').select('*'),
        supabase.from('seller_fees').select('*', { count: 'exact', head: true }).not('frozen_at', 'is', null),
        supabase.from('stores').select('*, seller:profiles!stores_seller_id_fkey(full_name, email)').eq('is_verified', false).order('created_at', { ascending: false }),
        supabase.from('rider_fee_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('rider_fees').select('*', { count: 'exact', head: true }).not('frozen_at', 'is', null),
        supabase.from('rider_fees').select('*'),
      ]);

      const fees = (sellerFees.data || []) as any[];
      const totalCommission = fees.reduce((s, f) => s + Number(f.commission_balance || 0), 0);
      const totalSubscription = fees.reduce((s, f) => s + Number(f.subscription_balance || 0), 0);
      const rFees = (riderFees.data || []) as any[];
      const totalRiderFees = rFees.reduce((s, f) => s + Number(f.platform_fee_balance || 0), 0);

      setStats({
        stores: stores.count || 0,
        products: products.count || 0,
        buyers: buyers.count || 0,
        riders: riders.count || 0,
        sellers: sellers.count || 0,
        orders: orders.count || 0,
        pendingApprovals: pendingApprovals.count || 0,
        pendingPayments: pendingPayments.count || 0,
        pendingRiderPayments: pendingRiderPayments.count || 0,
        frozenSellers: frozenCount.count || 0,
        frozenRiders: frozenRiderCount.count || 0,
        totalCommission,
        totalSubscription,
        totalPlatformEarnings: totalCommission + totalSubscription + totalRiderFees,
        totalRiderFees,
        unverifiedStores: unverifiedStores.data || [],
      });
      setLoading(false);
    }
    load();

    // Realtime: reload when seller_fees, orders, or stores change so verification status stays live
    const sub = supabase.channel('admin-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_fees' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fees' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fee_payments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
        // If a store's is_verified changed, reload the overview
        if (payload.new && payload.old && payload.new.is_verified !== payload.old.is_verified) {
          load();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      {/* Alerts */}
      {stats.pendingApprovals > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            May {stats.pendingApprovals} account na naghihintay ng approval.
          </p>
        </div>
      )}
      {stats.pendingPayments > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4">
          <Wallet size={18} className="text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            May {stats.pendingPayments} seller payment na naghihintay ng approval.
          </p>
        </div>
      )}
      {stats.pendingRiderPayments > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4">
          <Bike size={18} className="text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            May {stats.pendingRiderPayments} rider payment na naghihintay ng approval.
          </p>
        </div>
      )}
      {stats.frozenSellers > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
          <Lock size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            May {stats.frozenSellers} seller na naka-freeze dahil sa hindi pagbabayad.
          </p>
        </div>
      )}
      {stats.frozenRiders > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
          <Bike size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            May {stats.frozenRiders} rider na naka-suspend dahil sa hindi pagbabayad.
          </p>
        </div>
      )}
      {stats.unverifiedStores.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 font-medium">
              May {stats.unverifiedStores.length} tindahan na naghihintay ng verification.
            </p>
          </div>
          <div className="space-y-2">
            {stats.unverifiedStores.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-amber-100">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.seller?.full_name} · {s.seller?.email}</p>
                </div>
                <button
                  onClick={async () => {
                    const { error } = await supabase.rpc('admin_verify_store', { p_store_id: s.id });
                    if (!error) {
                      setStats(prev => ({ ...prev, unverifiedStores: prev.unverifiedStores.filter((st: any) => st.id !== s.id) }));
                    }
                  }}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition"
                >
                  <Check size={14} /> Verify
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Earnings */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 mb-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={20} className="text-green-400" />
          <span className="text-sm font-medium text-gray-300">Platform Earnings (Outstanding)</span>
        </div>
        <p className="text-3xl font-bold">₱{stats.totalPlatformEarnings.toFixed(2)}</p>
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span>Commission: ₱{stats.totalCommission.toFixed(2)}</span>
          <span>Rent: ₱{stats.totalSubscription.toFixed(2)}</span>
          <span>Rider Fees: ₱{stats.totalRiderFees.toFixed(2)}</span>
        </div>
      </div>

      {/* User Stats */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm">Users</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { icon: StoreIcon, label: 'Sellers', value: stats.sellers, color: 'bg-orange-50 text-orange-600' },
          { icon: ShoppingBag, label: 'Buyers', value: stats.buyers, color: 'bg-green-50 text-green-600' },
          { icon: Bike, label: 'Riders', value: stats.riders, color: 'bg-blue-50 text-blue-600' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
              <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center mb-2 mx-auto`}>
                <Icon size={20} />
              </div>
              <p className="text-xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* Platform Stats */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm">Platform</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <StoreIcon size={18} className="text-brand-600" />
            <span className="text-xs text-gray-400">Tindahan</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.stores}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={18} className="text-purple-500" />
            <span className="text-xs text-gray-400">Paninda</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.products}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-green-600" />
            <span className="text-xs text-gray-400">Orders</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.orders}</p>
        </div>
      </div>
    </div>
  );
}

// ============= USERS TAB =============
type UserSubtab = 'active' | 'inactive' | 'pending';

function UsersTab({ onStartCall, onStartChat }: { onStartCall: (user: Profile) => void; onStartChat: (user: Profile) => void }) {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState<UserSubtab>('active');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reviewingUser, setReviewingUser] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (roleFilter !== 'all') q = q.eq('role', roleFilter);
    const { data } = await q;
    setUsers((data || []) as Profile[]);
    setLoading(false);
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleApproved(user: Profile) {
    await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id);
    load();
  }

  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    load();
  }

  async function deleteUser(user: Profile) {
    if (!adminProfile) return;
    if (!confirm(`Sigurado ka bang gusto mong PERMANENTENG burahin ang account ni ${user.full_name}? Hindi na ito maaaring bawiin. Mabubura rin ang lahat ng kaugnay na data (tindahan, orders, messages, atbp.)`)) return;
    setDeleting(user.id);
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: user.id,
        p_admin_id: adminProfile.id,
      });
      if (error) {
        alert('Error: ' + error.message);
      } else {
        load();
      }
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang pag-delete.'));
    }
    setDeleting(null);
  }

  const filtered = users.filter(u => {
    if (subtab === 'active') return u.is_approved && u.is_active;
    if (subtab === 'inactive') return u.is_approved && !u.is_active;
    if (subtab === 'pending') return !u.is_approved;
    return true;
  });

  const counts = {
    active: users.filter(u => u.is_approved && u.is_active).length,
    inactive: users.filter(u => u.is_approved && !u.is_active).length,
    pending: users.filter(u => !u.is_approved).length,
  };

  const subtabs: { id: UserSubtab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'inactive', label: 'Inactive', count: counts.inactive },
    { id: 'pending', label: 'Pending Approval', count: counts.pending },
  ];

  const roleFilters: { id: UserRole | 'all'; label: string }[] = [
    { id: 'all', label: 'Lahat' },
    { id: 'seller', label: 'Sellers' },
    { id: 'buyer', label: 'Buyers' },
    { id: 'rider', label: 'Riders' },
  ];

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">User Management</h2>

      {/* Subtabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
        {subtabs.map(st => (
          <button
            key={st.id}
            onClick={() => setSubtab(st.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              subtab === st.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
            }`}
          >
            {st.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              subtab === st.id ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
            }`}>
              {st.count}
            </span>
          </button>
        ))}
      </div>

      {/* Role Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {roleFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setRoleFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              roleFilter === f.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Walang users na nakita.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{user.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      user.role === 'seller' ? 'bg-orange-100 text-orange-700' :
                      user.role === 'buyer' ? 'bg-green-100 text-green-700' :
                      user.role === 'rider' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                    {user.id === adminProfile?.id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-white">You</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  user.is_approved ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {user.is_approved ? 'Approved' : 'Pending'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  user.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {subtab === 'pending' ? (
                  <button
                    onClick={() => toggleApproved(user)}
                    disabled={user.id === adminProfile?.id}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-green-600 text-white active:scale-95 transition disabled:opacity-30"
                  >
                    <UserCheck size={14} />
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => toggleActive(user)}
                    disabled={user.id === adminProfile?.id}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition disabled:opacity-30 ${
                      user.is_active
                        ? 'bg-red-50 text-red-600'
                        : 'bg-brand-50 text-brand-600'
                    }`}
                  >
                    <Power size={14} />
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <button
                  onClick={() => toggleApproved(user)}
                  disabled={user.id === adminProfile?.id}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition disabled:opacity-30 ${
                    user.is_approved
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-green-600 text-white'
                  }`}
                >
                  {user.is_approved ? <UserX size={14} /> : <UserCheck size={14} />}
                  {user.is_approved ? 'Disapprove' : 'Approve'}
                </button>
              </div>

              {/* View Profile Button */}
              <button
                onClick={() => setReviewingUser(user)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-brand-50 text-brand-600 border border-brand-200 active:scale-95 transition mb-2"
              >
                <Eye size={15} />
                Silipin ang Profile
              </button>

              {/* Chat + Video Call + Delete */}
              {user.id !== adminProfile?.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onStartChat(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 active:scale-95 transition"
                  >
                    <MessageCircle size={15} />
                    Chat
                  </button>
                  <button
                    onClick={() => onStartCall(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 active:scale-95 transition"
                  >
                    <Video size={15} />
                    Video Call
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    disabled={deleting === user.id}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-200 active:scale-95 transition disabled:opacity-50"
                  >
                    {deleting === user.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewingUser && (
        <UserProfileReview user={reviewingUser} onClose={() => setReviewingUser(null)} />
      )}
    </div>
  );
}

// ============= GEOGRAPHIC TAB =============
type GeoLevel = 'region' | 'city' | 'barangay' | 'palengke';

function GeographicTab() {
  const [level, setLevel] = useState<GeoLevel>('region');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [barangayFilter, setBarangayFilter] = useState<string>('');
  const [palengkeFilter, setPalengkeFilter] = useState<string>('');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, storeRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('stores').select('*'),
      ]);
      setAllProfiles((profileRes.data || []) as Profile[]);
      setAllStores((storeRes.data || []) as Store[]);
      setLoading(false);
    }
    load();
  }, []);

  const activeProfiles = allProfiles.filter(p => p.is_active && p.is_approved && p.role !== 'admin');

  // Build aggregation data
  type Row = {
    label: string;
    sellers: number;
    buyers: number;
    riders: number;
    total: number;
  };

  function getRowKey(p: Profile): string | null {
    if (level === 'region') return p.region;
    if (level === 'city') return p.city;
    if (level === 'barangay') return p.barangay;
    return null;
  }

  // For palengke level, we need to join with stores
  function getPalengkeRows(): Row[] {
    const sellerProfiles = activeProfiles.filter(p => p.role === 'seller');
    const sellerIds = new Set(sellerProfiles.map(p => p.id));
    const storesInFilter = allStores.filter(s => {
      if (regionFilter && s.region !== regionFilter) return false;
      if (cityFilter && s.city !== cityFilter) return false;
      if (barangayFilter && s.barangay !== barangayFilter) return false;
      return true;
    });
    const palengkeMap: Record<string, Row> = {};
    for (const s of storesInFilter) {
      if (!s.palengke_name) continue;
      const seller = sellerProfiles.find(p => p.id === s.seller_id);
      if (!seller) continue;
      if (!palengkeMap[s.palengke_name]) {
        palengkeMap[s.palengke_name] = { label: s.palengke_name, sellers: 0, buyers: 0, riders: 0, total: 0 };
      }
      palengkeMap[s.palengke_name].sellers++;
      palengkeMap[s.palengke_name].total++;
    }
    return Object.values(palengkeMap).sort((a, b) => b.total - a.total);
  }

  function getRows(): Row[] {
    if (level === 'palengke') return getPalengkeRows();

    const filtered = activeProfiles.filter(p => {
      if (regionFilter && p.region !== regionFilter) return false;
      if (cityFilter && p.city !== cityFilter) return false;
      if (barangayFilter && p.barangay !== barangayFilter) return false;
      return true;
    });

    const map: Record<string, Row> = {};
    for (const p of filtered) {
      const key = getRowKey(p);
      if (!key) continue;
      if (!map[key]) {
        map[key] = { label: key, sellers: 0, buyers: 0, riders: 0, total: 0 };
      }
      if (p.role === 'seller') map[key].sellers++;
      else if (p.role === 'buyer') map[key].buyers++;
      else if (p.role === 'rider') map[key].riders++;
      map[key].total++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  // Build available filter options based on current data
  const regions = [...new Set(activeProfiles.map(p => p.region).filter(Boolean))].sort() as string[];
  const cities = [...new Set(activeProfiles.filter(p => !regionFilter || p.region === regionFilter).map(p => p.city).filter(Boolean))].sort() as string[];
  const barangays = [...new Set(activeProfiles.filter(p => (!regionFilter || p.region === regionFilter) && (!cityFilter || p.city === cityFilter)).map(p => p.barangay).filter(Boolean))].sort() as string[];
  const palengkes = [...new Set(allStores.filter(s => {
    if (regionFilter && s.region !== regionFilter) return false;
    if (cityFilter && s.city !== cityFilter) return false;
    if (barangayFilter && s.barangay !== barangayFilter) return false;
    return true;
  }).map(s => s.palengke_name).filter(Boolean))].sort() as string[];

  const rows = getRows();
  const maxTotal = Math.max(...rows.map(r => r.total), 1);

  const levelLabels: Record<GeoLevel, string> = {
    region: 'Region',
    city: 'City/Municipality',
    barangay: 'Barangay',
    palengke: 'Palengke',
  };

  const levels: { id: GeoLevel; label: string }[] = [
    { id: 'region', label: 'Region' },
    { id: 'city', label: 'City' },
    { id: 'barangay', label: 'Barangay' },
    { id: 'palengke', label: 'Palengke' },
  ];

  function resetBelow(l: GeoLevel) {
    if (l === 'region') { setCityFilter(''); setBarangayFilter(''); setPalengkeFilter(''); }
    if (l === 'city') { setBarangayFilter(''); setPalengkeFilter(''); }
    if (l === 'barangay') { setPalengkeFilter(''); }
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-1">Geographic Distribution</h2>
      <p className="text-xs text-gray-400 mb-4">Tingnan ang dami ng active sellers, buyers, at riders bawat lugar.</p>

      {/* Level selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {levels.map(l => (
          <button
            key={l.id}
            onClick={() => { setLevel(l.id); resetBelow(l.id); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              level === l.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Region</label>
          <select
            value={regionFilter}
            onChange={(e) => { setRegionFilter(e.target.value); resetBelow('region'); }}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white"
          >
            <option value="">Lahat ng Region</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">City/Municipality</label>
          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); resetBelow('city'); }}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white disabled:bg-gray-50"
            disabled={regions.length === 0}
          >
            <option value="">Lahat ng City</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {level !== 'palengke' && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Barangay</label>
            <select
              value={barangayFilter}
              onChange={(e) => { setBarangayFilter(e.target.value); resetBelow('barangay'); }}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white disabled:bg-gray-50"
              disabled={cities.length === 0}
            >
              <option value="">Lahat ng Barangay</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        {level === 'palengke' && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Palengke</label>
            <select
              value={palengkeFilter}
              onChange={(e) => setPalengkeFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white disabled:bg-gray-50"
              disabled={palengkes.length === 0}
            >
              <option value="">Lahat ng Palengke</option>
              {palengkes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { icon: StoreIcon, label: 'Sellers', value: rows.reduce((s, r) => s + r.sellers, 0), color: 'bg-orange-50 text-orange-600' },
            { icon: ShoppingBag, label: 'Buyers', value: rows.reduce((s, r) => s + r.buyers, 0), color: 'bg-green-50 text-green-600' },
            { icon: Bike, label: 'Riders', value: rows.reduce((s, r) => s + r.riders, 0), color: 'bg-blue-50 text-blue-600' },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center mb-2 mx-auto`}>
                  <Icon size={20} />
                </div>
                <p className="text-xl font-bold text-gray-800">{c.value}</p>
                <p className="text-xs text-gray-400">{c.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Walang data para sa mga filter na ito.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 mb-1">
            {rows.length} {levelLabels[level]}{rows.length !== 1 ? 's' : ''} na may active users
          </p>
          {rows.map((row, i) => (
            <div key={row.label} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-300 flex-shrink-0">#{i + 1}</span>
                  <p className="font-semibold text-sm text-gray-800 truncate">{row.label}</p>
                </div>
                <span className="text-sm font-bold text-gray-700 flex-shrink-0">{row.total}</span>
              </div>
              {/* Bar */}
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                  style={{ width: `${(row.total / maxTotal) * 100}%` }}
                />
              </div>
              {/* Breakdown */}
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-orange-600">
                  <StoreIcon size={12} /> {row.sellers}
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  <ShoppingBag size={12} /> {row.buyers}
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Bike size={12} /> {row.riders}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= CAMPAIGNS TAB =============
type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  target_role: string;
  target_region: string | null;
  target_city: string | null;
  target_barangay: string | null;
  status: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

const CAMPAIGN_PRESETS = [
  {
    label: 'Pasko (Christmas)',
    subject: 'Maligayang Pasko! Handa na ba ang inyong handaan?',
    body: 'Maligayang Pasko!\n\nMalapit na ang Pasko at siguradong maraming handaan ang naghihintay. Bago pa lumipas ang oras, siguraduhing nakapamili na kayo ng sariwang ingredients para sa inyong Noche Buena at handaan.\n\nSa GoPalengke, pwede niyong i-order online ang inyong mga pangkape, gulay, karne, at iba pa — idedeliver diretso sa inyong bahay!\n\nMag-order na bago pa magkagulo sa palengke. Maligayang Pasko sa inyong pamilya!',
  },
  {
    label: 'Bagong Taon (New Year)',
    subject: 'Masayang Bagong Taon! Planuhin ang inyong handaan',
    body: 'Masayang Bagong Taon!\n\nBago magsimula ang bagong taon, planuhin na ang inyong Media Noche. Sa GoPalengke, maraming sariwang pagkain ang pwede niyong i-order online — mula sa prutas, gulay, karne, hanggang sa inumin.\n\nHuwag nang magpaka-stress sa pila sa palengke. Mag-order na online at idedeliver diretso sa inyong tahanan.\n\nMasayang Bagong Taon sa inyong lahat!',
  },
  {
    label: 'Fiesta / Pista sa Lugar',
    subject: 'May fiesta ba sa inyong lugar? Maghanda na sa GoPalengke!',
    body: 'Kamusta!\n\nNaririnig namin na may malapit na fiesta sa inyong lugar. Siguradong maraming handaan at paghahanda ang naghihintay!\n\nBago matapos ang araw, siguraduhing nakapamili na kayo ng sariwang ingredients para sa inyong mga lulutuin. Sa GoPalengke, pwede niyong i-order online ang lahat ng kailangan — gulay, karne, isda, prutas, at iba pa — at idedeliver sa inyong bahay.\n\nMag-order na habang maaga pa. Maligayang fiesta!',
  },
  {
    label: 'Semana Santa (Holy Week)',
    subject: 'Semana Santa na! Maghanda ng sariwang pagkain',
    body: 'Kamusta!\n\nMalapit na ang Semana Santa. Panahon ito ng pagmumuni-muni at paghahanda ng sariwang pagkain para sa pamilya.\n\nSa GoPalengke, pwede niyong i-order online ang sariwang isda, gulay, prutas, at iba pang kailangan para sa inyong mga lutuin — walang pila, walang hassle.\n\nMag-order na nang maaga. Mapayapang Semana Santa sa inyong pamilya.',
  },
  {
    label: 'Buwan ng Wika (August)',
    subject: 'Buwan ng Wika! Sariwang ingredients para sa klasikong putahe',
    body: 'Kamusta!\n\nIto ang Buwan ng Wika — tamang panahon para magluto ng mga klasikong Pilipinong putahe para sa pamilya.\n\nSa GoPalengke, pwede niyong i-order online ang sariwang gulay, karne, isda, at iba pang kailangan para sa adobo, sinigang, kare-kare, at higit pa. Idedeliver diretso sa inyong bahay.\n\nMag-order na at ipagdiwang ang ating sariling wika at lutuin!',
  },
  {
    label: 'Ber Months Reminder',
    subject: 'Ber months na! Simulan na ang paghahanda',
    body: 'Kamusta!\n\nNagsimula na ang ber months! Unti-unting lumalamig ang panahon at siguradong maraming okasyon ang darating — pasko, reunion, handaan.\n\nSa GoPalengke, pwede niyong i-order online ang sariwang pagkain anumang oras. Walang pila, walang abala — idedeliver diretso sa inyong bahay.\n\nMag-order na at maging handa sa mga darating na okasyon!',
  },
];

function CampaignsTab() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<string>('all');
  const [targetRegion, setTargetRegion] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [targetBarangay, setTargetBarangay] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview count
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    setCampaigns((data || []) as EmailCampaign[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'EMAIL_SENDING_ENABLED').maybeSingle().then(({ data }) => {
      setEmailEnabled((data as { value: string } | null)?.value !== 'false');
    });
  }, []);

  // Count recipients for current filter
  useEffect(() => {
    async function countRecipients() {
      if (!showCreate) { setPreviewCount(null); return; }
      setCounting(true);
      let q = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_approved', true)
        .eq('is_active', true)
        .not('email', 'is', null);
      if (targetRole !== 'all') q = q.eq('role', targetRole);
      if (targetRegion) q = q.eq('region', targetRegion);
      if (targetCity) q = q.eq('city', targetCity);
      if (targetBarangay) q = q.eq('barangay', targetBarangay);
      const { count } = await q;
      setPreviewCount(count || 0);
      setCounting(false);
    }
    countRecipients();
  }, [showCreate, targetRole, targetRegion, targetCity, targetBarangay]);

  function applyPreset(preset: typeof CAMPAIGN_PRESETS[0]) {
    setName(preset.label);
    setSubject(preset.subject);
    setBody(preset.body);
  }

  async function handleCreate() {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('email_campaigns').insert({
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      target_role: targetRole,
      target_region: targetRegion || null,
      target_city: targetCity || null,
      target_barangay: targetBarangay || null,
      status: 'draft',
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    setName(''); setSubject(''); setBody('');
    setTargetRole('all'); setTargetRegion(''); setTargetCity(''); setTargetBarangay('');
    setShowCreate(false);
    load();
  }

  async function sendCampaign(campaign: EmailCampaign) {
    if (!confirm(`Sigurado ka bang ipadala ang "${campaign.name}" sa lahat ng target recipients?`)) return;
    setSending(campaign.id);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert('Error: ' + (result.error || 'Failed to send'));
      }
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
    setSending(null);
    load();
  }

  async function deleteCampaign(campaign: EmailCampaign) {
    if (!confirm(`Sigurado ka bang burahin ang "${campaign.name}"?`)) return;
    await supabase.from('email_campaigns').delete().eq('id', campaign.id);
    load();
  }

  // Get available regions/cities from profiles
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const [allCities, setAllCities] = useState<string[]>([]);
  const [allBarangays, setAllBarangays] = useState<string[]>([]);

  useEffect(() => {
    async function loadLocations() {
      const { data } = await supabase
        .from('profiles')
        .select('region, city, barangay')
        .eq('is_approved', true)
        .eq('is_active', true);
      const profiles = (data || []) as any[];
      setAllRegions([...new Set(profiles.map(p => p.region).filter(Boolean))] as string[]);
      setAllCities([...new Set(profiles.filter(p => !targetRegion || p.region === targetRegion).map(p => p.city).filter(Boolean))] as string[]);
      setAllBarangays([...new Set(profiles.filter(p => (!targetRegion || p.region === targetRegion) && (!targetCity || p.city === targetCity)).map(p => p.barangay).filter(Boolean))] as string[]);
    }
    if (showCreate) loadLocations();
  }, [showCreate, targetRegion, targetCity]);

  const roleOptions = [
    { id: 'all', label: 'Lahat ng Users' },
    { id: 'buyer', label: 'Buyers Only' },
    { id: 'seller', label: 'Sellers Only' },
    { id: 'rider', label: 'Riders Only' },
  ];

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Email Campaigns</h2>
          <p className="text-xs text-gray-400">Magpadala ng email reminders sa users para sa okasyon at events.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
        >
          <Plus size={16} /> Bagong Campaign
        </button>
      </div>

      {!emailEnabled && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl p-3 mb-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            Nakaka-disable ang email sending. Pumunta sa Settings para i-on.
          </p>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Mail size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">Wala pang campaigns.</p>
          <p className="text-gray-400 text-xs mt-1">Gumawa ng bagong email campaign para sa okason o event.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">Subject: {c.subject}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  c.status === 'sent' ? 'bg-green-100 text-green-700' :
                  c.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                  c.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {c.status === 'sent' ? 'Sent' : c.status === 'sending' ? 'Sending...' : c.status === 'failed' ? 'Failed' : 'Draft'}
                </span>
              </div>

              {/* Target info */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
                  {c.target_role === 'all' ? 'All Users' : c.target_role === 'buyer' ? 'Buyers' : c.target_role === 'seller' ? 'Sellers' : 'Riders'}
                </span>
                {c.target_region && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.target_region}</span>}
                {c.target_city && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.target_city}</span>}
                {c.target_barangay && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.target_barangay}</span>}
              </div>

              {/* Stats */}
              {c.status === 'sent' && (
                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1 text-green-600"><Check size={12} /> Sent: {c.sent_count}</span>
                  {c.failed_count > 0 && <span className="flex items-center gap-1 text-red-500"><X size={12} /> Failed: {c.failed_count}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {c.status === 'draft' && (
                  <button
                    onClick={() => sendCampaign(c)}
                    disabled={sending === c.id || !emailEnabled}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 text-white active:scale-95 transition disabled:opacity-50"
                  >
                    {sending === c.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sending === c.id ? 'Nagpapadala...' : 'Ipadala'}
                  </button>
                )}
                <button
                  onClick={() => deleteCampaign(c)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-red-50 text-red-500 border border-red-200 active:scale-95 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Bagong Email Campaign</h3>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Preset Templates</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CAMPAIGN_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100 whitespace-nowrap active:scale-95 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Pangalan ng Campaign</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Hal. Pasko 2026 Reminder"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject ng email"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email Body</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Laman ng email..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 resize-none"
                />
              </div>

              {/* Target */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Target Users</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {roleOptions.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setTargetRole(r.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                        targetRole === r.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Region (optional)</label>
                <select
                  value={targetRegion}
                  onChange={e => { setTargetRegion(e.target.value); setTargetCity(''); setTargetBarangay(''); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white"
                >
                  <option value="">Lahat ng Region</option>
                  {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">City (optional)</label>
                <select
                  value={targetCity}
                  onChange={e => { setTargetCity(e.target.value); setTargetBarangay(''); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white disabled:bg-gray-50"
                  disabled={allCities.length === 0}
                >
                  <option value="">Lahat ng City</option>
                  {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Barangay (optional)</label>
                <select
                  value={targetBarangay}
                  onChange={e => setTargetBarangay(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 bg-white disabled:bg-gray-50"
                  disabled={allBarangays.length === 0}
                >
                  <option value="">Lahat ng Barangay</option>
                  {allBarangays.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Recipient count preview */}
              <div className="bg-brand-50 rounded-xl p-3 flex items-center gap-2">
                <Users size={16} className="text-brand-600 flex-shrink-0" />
                <p className="text-xs text-brand-700 font-medium">
                  {counting ? 'Nagbibilang...' : `${previewCount ?? 0} recipients ang makakatanggap`}
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Nagsasave...' : 'I-save ang Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= FEES TAB =============
type SellerFeeWithSeller = SellerFee & { seller: { full_name: string; email: string } | null };

function FeesTab() {
  const { profile: adminProfile } = useAuth();
  const [payments, setPayments] = useState<(FeePayment & { seller: { full_name: string; email: string } })[]>([]);
  const [frozenSellers, setFrozenSellers] = useState<(SellerFee & { seller: { full_name: string; email: string } })[]>([]);
  const [allFees, setAllFees] = useState<SellerFeeWithSeller[]>([]);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [sellerOrders, setSellerOrders] = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [payData, frozenData, allFeesData] = await Promise.all([
      supabase
        .from('fee_payments')
        .select('*, seller:profiles!fee_payments_seller_id_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('seller_fees')
        .select('*, seller:profiles!seller_fees_seller_id_fkey(full_name, email)')
        .not('frozen_at', 'is', null)
        .order('frozen_at', { ascending: false }),
      supabase
        .from('seller_fees')
        .select('*, seller:profiles!seller_fees_seller_id_fkey(full_name, email)')
        .order('updated_at', { ascending: false }),
    ]);
    setPayments((payData.data || []) as any);
    setFrozenSellers((frozenData.data || []) as any);
    setAllFees((allFeesData.data || []) as SellerFeeWithSeller[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSellerOrders(sellerId: string) {
    if (expandedSeller === sellerId) {
      setExpandedSeller(null);
      return;
    }
    setExpandedSeller(sellerId);
    if (sellerOrders[sellerId]) return;
    setLoadingOrders(true);
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('seller_id', sellerId);
    const storeIds = (stores || []).map((s: any) => s.id);
    if (storeIds.length === 0) {
      setSellerOrders(prev => ({ ...prev, [sellerId]: [] }));
      setLoadingOrders(false);
      return;
    }
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, commission_amount, status, payment_status, payment_method, commission_applied, created_at, store:stores!orders_store_id_fkey(name)')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(50);
    setSellerOrders(prev => ({ ...prev, [sellerId]: orders || [] }));
    setLoadingOrders(false);
  }

  async function approvePayment(payment: FeePayment) {
    if (!adminProfile) return;
    setProcessing(payment.id);
    try {
      const { error } = await supabase.rpc('approve_fee_payment', {
        p_payment_id: payment.id,
        p_admin_id: adminProfile.id,
      });
      if (error) {
        alert('Error: ' + error.message);
      }
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang approval.'));
    }
    setProcessing(null);
    load();
  }

  async function rejectPayment(payment: FeePayment) {
    if (!confirm('Sigurado ka bang gusto mong i-reject ang payment na ito?')) return;
    setProcessing(payment.id);
    try {
      await supabase.from('fee_payments').update({ status: 'rejected' }).eq('id', payment.id);
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang reject.'));
    }
    setProcessing(null);
    load();
  }

  async function reactivateSeller(sellerId: string) {
    if (!confirm('Sigurado ka bang gusto mong i-reactivate ang seller na ito? Titiyakin na nakapagbayad na siya.')) return;
    setReactivating(sellerId);
    try {
      const { error } = await supabase.rpc('reactivate_seller', { p_seller_id: sellerId });
      if (error) {
        alert('Error: ' + error.message);
      }
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang reactivation.'));
    }
    setReactivating(null);
    load();
  }

  const pending = payments.filter(p => p.status === 'pending');
  const history = payments.filter(p => p.status !== 'pending');

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Fee Payments</h2>

      {pending.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            May {pending.length} payment na naghihintay ng approval.
          </p>
        </div>
      )}

      {/* Pending Payments */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm">Naghihintay ng Approval</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : pending.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6 mb-4">Walang pending payments.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{p.seller?.full_name || 'Seller'}</p>
                  <p className="text-xs text-gray-400">{p.seller?.email}</p>
                </div>
                <p className="font-bold text-lg text-gray-800">₱{Number(p.amount || 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 mb-3">
                <p className="text-xs text-gray-400">Reference Number</p>
                <p className="text-sm font-mono text-gray-700">{p.reference_number}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approvePayment(p)}
                  disabled={processing === p.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  {processing === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
                <button
                  onClick={() => rejectPayment(p)}
                  disabled={processing === p.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Frozen Sellers */}
      {frozenSellers.length > 0 && (
        <>
          <h3 className="font-bold text-red-700 mb-3 text-sm flex items-center gap-2 mt-4">
            <Lock size={16} /> Naka-freeze na Seller
          </h3>
          <div className="space-y-2 mb-6">
            {frozenSellers.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-red-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{f.seller?.full_name || 'Seller'}</p>
                    <p className="text-xs text-gray-400">{f.seller?.email}</p>
                  </div>
                  <p className="font-bold text-lg text-red-600">₱{Number(f.total_payable || 0).toFixed(2)}</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Na-freeze no: {f.frozen_at ? new Date(f.frozen_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </p>
                <button
                  onClick={() => reactivateSeller(f.seller_id)}
                  disabled={reactivating === f.seller_id}
                  className="w-full flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  {reactivating === f.seller_id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  Reactivate Seller
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payment History */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
        <Receipt size={16} /> Kasaysayan
      </h3>
      {history.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">Wala pang payment history.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {history.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-800">{p.seller?.full_name || 'Seller'}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {p.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Ref: {p.reference_number}</p>
                <p className="font-semibold text-sm text-gray-700">₱{Number(p.amount || 0).toFixed(2)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Seller Sales Breakdown */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2 mt-4">
        <TrendingUp size={16} /> Sales Breakdown ng Seller
      </h3>
      {allFees.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">Wala pang seller sales data.</p>
      ) : (
        <div className="space-y-2">
          {allFees.map((f) => {
            const totalSales = Number(f.total_sales || 0);
            const commissionBalance = Number(f.commission_balance || 0);
            const subscriptionBalance = Number(f.subscription_balance || 0);
            const totalPayable = Number(f.total_payable || 0);
            const subscriptionActive = f.subscription_active;
            const salesProgress = Math.min(100, (totalSales / SUBSCRIPTION_THRESHOLD) * 100);
            const isExpanded = expandedSeller === f.seller_id;
            const orders = sellerOrders[f.seller_id];

            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <button
                  onClick={() => toggleSellerOrders(f.seller_id)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-600 font-bold text-xs">
                        {(f.seller?.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{f.seller?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">{f.seller?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      f.frozen_at ? 'bg-red-100 text-red-700' :
                      subscriptionActive ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {f.frozen_at ? 'Frozen' : subscriptionActive ? 'Rent Active' : 'Free Tier'}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Summary grid */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Total Sales</p>
                    <p className="font-bold text-sm text-gray-800">₱{totalSales.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Total Payable</p>
                    <p className="font-bold text-sm text-gray-800">₱{totalPayable.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Commission (3%)</p>
                    <p className="font-bold text-sm text-gray-800">₱{commissionBalance.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Monthly Rent</p>
                    <p className="font-bold text-sm text-gray-800">₱{subscriptionBalance.toFixed(2)}</p>
                  </div>
                </div>

                {/* Subscription progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span>Rent Threshold (₱{SUBSCRIPTION_THRESHOLD.toFixed(0)})</span>
                    <span>{salesProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${subscriptionActive ? 'bg-green-500' : 'bg-brand-500'}`}
                      style={{ width: `${salesProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {subscriptionActive
                      ? `Na-activate noong ${f.subscription_activated_at ? new Date(f.subscription_activated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}`
                      : `₱${(SUBSCRIPTION_THRESHOLD - totalSales).toFixed(2)} pa bago ma-activate ang ₱700 monthly rent`
                    }
                  </p>
                </div>

                {/* Expanded order breakdown */}
                {isExpanded && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Mga Orders (pinakabago, hanggang 50)</p>
                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-brand-500" />
                      </div>
                    ) : !orders || orders.length === 0 ? (
                      <p className="text-center text-gray-400 text-xs py-4">Wala pang orders ang seller na ito.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {orders.map((o: any) => (
                          <div key={o.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-700 truncate">
                                {o.store?.name || 'Store'} · ₱{Number(o.total).toFixed(2)}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {o.payment_method === 'cod' ? 'COD' : 'QR'} · {o.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                o.commission_applied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {o.commission_applied ? 'Applied' : 'Pending'}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">₱{Number(o.commission_amount).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= RIDER FEES TAB =============
function RiderFeesTab() {
  const { profile: adminProfile } = useAuth();
  const [payments, setPayments] = useState<(RiderFeePayment & { rider: { full_name: string; email: string } })[]>([]);
  const [frozenRiders, setFrozenRiders] = useState<(RiderFee & { rider: { full_name: string; email: string } })[]>([]);
  const [allRiderFees, setAllRiderFees] = useState<(RiderFee & { rider: { full_name: string; email: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [payData, frozenData, allFeesData] = await Promise.all([
      supabase.from('rider_fee_payments')
        .select('*, rider:profiles!rider_fee_payments_rider_id_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('rider_fees')
        .select('*, rider:profiles!rider_fees_rider_id_fkey(full_name, email)')
        .not('frozen_at', 'is', null)
        .order('frozen_at', { ascending: false }),
      supabase.from('rider_fees')
        .select('*, rider:profiles!rider_fees_rider_id_fkey(full_name, email)')
        .order('updated_at', { ascending: false }),
    ]);
    setPayments((payData.data || []) as any);
    setFrozenRiders((frozenData.data || []) as any);
    setAllRiderFees((allFeesData.data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase.channel('admin-rider-fees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fee_payments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_fees' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  async function approvePayment(payment: RiderFeePayment) {
    if (!adminProfile) return;
    setProcessing(payment.id);
    try {
      const { error } = await supabase.rpc('approve_rider_fee_payment', {
        p_payment_id: payment.id,
        p_admin_id: adminProfile.id,
      });
      if (error) alert('Error: ' + error.message);
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang approval.'));
    }
    setProcessing(null);
    load();
  }

  async function rejectPayment(payment: RiderFeePayment) {
    if (!confirm('Sigurado ka bang gusto mong i-reject ang payment na ito?')) return;
    setProcessing(payment.id);
    try {
      await supabase.from('rider_fee_payments').update({ status: 'rejected' }).eq('id', payment.id);
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang reject.'));
    }
    setProcessing(null);
    load();
  }

  async function reactivateRider(riderId: string) {
    if (!confirm('Sigurado ka bang gusto mong i-reactivate ang rider na ito? Titiyakin na nakapagbayad na siya.')) return;
    setReactivating(riderId);
    try {
      const { error } = await supabase.rpc('reactivate_rider', { p_rider_id: riderId });
      if (error) alert('Error: ' + error.message);
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'Hindi matapos ang reactivation.'));
    }
    setReactivating(null);
    load();
  }

  const pending = payments.filter(p => p.status === 'pending');
  const history = payments.filter(p => p.status !== 'pending');

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Rider Fee Payments</h2>

      {pending.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            May {pending.length} rider payment na naghihintay ng approval.
          </p>
        </div>
      )}

      {/* Pending Payments */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm">Naghihintay ng Approval</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : pending.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6 mb-4">Walang pending rider payments.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{p.rider?.full_name || 'Rider'}</p>
                  <p className="text-xs text-gray-400">{p.rider?.email}</p>
                </div>
                <p className="font-bold text-lg text-gray-800">₱{Number(p.amount || 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 mb-3">
                <p className="text-xs text-gray-400">Reference Number</p>
                <p className="text-sm font-mono text-gray-700">{p.reference_number}</p>
              </div>
              {p.screenshot_url && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Receipt Screenshot:</p>
                  <img src={p.screenshot_url} alt="Receipt" className="w-full max-w-48 rounded-xl border border-gray-100" />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => approvePayment(p)}
                  disabled={processing === p.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  {processing === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
                <button
                  onClick={() => rejectPayment(p)}
                  disabled={processing === p.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Frozen Riders */}
      {frozenRiders.length > 0 && (
        <>
          <h3 className="font-bold text-red-700 mb-3 text-sm flex items-center gap-2 mt-4">
            <Lock size={16} /> Naka-suspend na Rider
          </h3>
          <div className="space-y-2 mb-6">
            {frozenRiders.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-red-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{f.rider?.full_name || 'Rider'}</p>
                    <p className="text-xs text-gray-400">{f.rider?.email}</p>
                  </div>
                  <p className="font-bold text-lg text-red-600">₱{Number(f.total_payable || 0).toFixed(2)}</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Na-suspend no: {f.frozen_at ? new Date(f.frozen_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </p>
                <button
                  onClick={() => reactivateRider(f.rider_id)}
                  disabled={reactivating === f.rider_id}
                  className="w-full flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  {reactivating === f.rider_id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  Reactivate Rider
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payment History */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
        <Receipt size={16} /> Kasaysayan
      </h3>
      {history.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">Wala pang rider payment history.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {history.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-800">{p.rider?.full_name || 'Rider'}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {p.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Ref: {p.reference_number}</p>
                <p className="font-semibold text-sm text-gray-700">₱{Number(p.amount || 0).toFixed(2)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Rider Earnings Breakdown */}
      <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2 mt-4">
        <Bike size={16} /> Earnings Breakdown ng Rider
      </h3>
      {allRiderFees.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">Wala pang rider earnings data.</p>
      ) : (
        <div className="space-y-2">
          {allRiderFees.map((f) => {
            const totalEarnings = Number(f.total_career_earnings || 0);
            const platformBalance = Number(f.platform_fee_balance || 0);
            const totalPayable = Number(f.total_payable || 0);
            const onboardingStatus = f.onboarding_fee_status;
            const isFrozen = !!f.frozen_at;

            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-xs">
                        {(f.rider?.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{f.rider?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{f.rider?.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isFrozen ? 'bg-red-100 text-red-700' :
                    onboardingStatus === 'paid' ? 'bg-green-100 text-green-700' :
                    onboardingStatus === 'active' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {isFrozen ? 'Suspended' : onboardingStatus === 'paid' ? 'Onboarding Paid' : onboardingStatus === 'active' ? 'Onboarding Active' : 'Free Tier'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Career Earnings</p>
                    <p className="font-bold text-sm text-gray-800">₱{totalEarnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Total Payable</p>
                    <p className="font-bold text-sm text-gray-800">₱{totalPayable.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Platform Fee (3%)</p>
                    <p className="font-bold text-sm text-gray-800">₱{platformBalance.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Onboarding</p>
                    <p className="font-bold text-sm text-gray-800 capitalize">{onboardingStatus}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= ANNOUNCEMENTS =============
function AnnouncementsTab() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { loadAnnouncements(); }, []);

  async function loadAnnouncements() {
    setLoading(true);
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements((data || []) as Announcement[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    await supabase.from('announcements').update({ is_active: false }).eq('is_active', true);
    const { error: insertError } = await supabase.from('announcements').insert({
      message: newMessage.trim(),
      is_active: true,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setNewMessage('');
      setSuccess('Matagumpay na nai-save ang announcement!');
      setTimeout(() => setSuccess(null), 3000);
      loadAnnouncements();
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    if (currentActive) {
      await supabase.from('announcements').update({ is_active: false }).eq('id', id);
    } else {
      await supabase.from('announcements').update({ is_active: false }).eq('is_active', true);
      await supabase.from('announcements').update({ is_active: true }).eq('id', id);
    }
    loadAnnouncements();
  }

  async function handleDelete(id: string) {
    if (!confirm('Sigurado ka bang gusto mong burahin ang announcement na ito?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  }

  return (
    <div className="px-5 py-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone size={20} className="text-brand-600" />
          <h3 className="font-bold text-gray-800">Bagong Announcement</h3>
        </div>
        <form onSubmit={handleCreate}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ilagay ang announcement message dito..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{newMessage.length}/500</span>
            <button
              type="submit"
              disabled={saving || !newMessage.trim()}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'Nagsasave...' : 'I-save'}
            </button>
          </div>
        </form>
        {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg mt-2">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-2 rounded-lg mt-2">
            <Check size={16} /> {success}
          </div>
        )}
      </div>

      {announcements.some(a => a.is_active) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex items-center gap-2">
          <Megaphone size={16} className="text-amber-600 flex-shrink-0" />
          <div className="overflow-hidden flex-1">
            <p className="text-xs text-amber-600 font-medium mb-0.5">Kasalukuyang Live:</p>
            <p className="text-sm text-amber-800 truncate">
              {announcements.find(a => a.is_active)?.message}
            </p>
          </div>
        </div>
      )}

      <h3 className="font-bold text-gray-800 mb-3 text-sm">Kasaysayan ng Announcements</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Wala pang announcements.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl border p-4 ${a.is_active ? 'border-green-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm text-gray-700 flex-1">{a.message}</p>
                {a.is_active && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(a.id, a.is_active)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      a.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'
                    }`}
                  >
                    <Power size={12} />
                    {a.is_active ? 'Itago' : 'Ilive'}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 transition"
                  >
                    <Trash2 size={12} />
                    Burahin
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= SETTINGS TAB =============
type PlatformQrCode = {
  id: string;
  label: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
};

function SettingsTab() {
  const { profile } = useAuth();
  const [qrCodes, setQrCodes] = useState<PlatformQrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Email provider API key state
  const [emailKey, setEmailKey] = useState('');
  const [emailKeySaving, setEmailKeySaving] = useState(false);
  const [emailKeyStatus, setEmailKeyStatus] = useState<'none' | 'configured' | 'missing'>('none');

  // Email sending toggle state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailToggling, setEmailToggling] = useState(false);

  const loadEmailKey = useCallback(async () => {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'EMAIL_PROVIDER_KEY').maybeSingle();
    if (data) {
      setEmailKeyStatus('configured');
      setEmailKey('');
    } else {
      setEmailKeyStatus('missing');
    }
  }, []);

  const loadEmailEnabled = useCallback(async () => {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'EMAIL_SENDING_ENABLED').maybeSingle();
    const val = (data as { value: string } | null)?.value;
    setEmailEnabled(val !== 'false');
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from('platform_qr_codes').select('*').order('created_at', { ascending: false });
    setQrCodes((data || []) as PlatformQrCode[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadEmailKey(); loadEmailEnabled(); }, [load, loadEmailKey, loadEmailEnabled]);

  async function addQrCode() {
    if (!newImageUrl.trim() || !newLabel.trim()) return;
    setSaving(true);
    setSuccess(null);
    const { error } = await supabase.from('platform_qr_codes').insert({
      label: newLabel.trim(),
      image_url: newImageUrl.trim(),
      is_active: qrCodes.length === 0,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setNewLabel('');
      setNewImageUrl('');
      setShowAddModal(false);
      setSuccess('Nai-save ang QR code!');
      setTimeout(() => setSuccess(null), 3000);
      load();
    }
  }

  async function toggleActiveQr(qr: PlatformQrCode) {
    if (qr.is_active) {
      await supabase.from('platform_qr_codes').update({ is_active: false }).eq('id', qr.id);
    } else {
      await supabase.from('platform_qr_codes').update({ is_active: false }).eq('is_active', true);
      await supabase.from('platform_qr_codes').update({ is_active: true }).eq('id', qr.id);
    }
    load();
  }

  async function deleteQr(qr: PlatformQrCode) {
    if (!confirm(`Sigurado ka bang burahin ang "${qr.label}" QR code?`)) return;
    await supabase.from('platform_qr_codes').delete().eq('id', qr.id);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Platform Settings</h2>

      {/* Email Sending Toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={20} className="text-brand-600" />
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Email Sending</h3>
              <p className="text-xs text-gray-400 mt-0.5">I-on o i-off ang pagpapadala ng email campaigns.</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setEmailToggling(true);
              const newVal = !emailEnabled;
              const { error } = await supabase.from('platform_settings').upsert({
                key: 'EMAIL_SENDING_ENABLED',
                value: String(newVal),
                updated_by: profile?.id,
              });
              setEmailToggling(false);
              if (error) { alert('Error: ' + error.message); return; }
              setEmailEnabled(newVal);
              setSuccess(newVal ? 'Pinagana ang email sending!' : 'Na-disable ang email sending.');
              setTimeout(() => setSuccess(null), 3000);
            }}
            disabled={emailToggling}
            className={`relative w-12 h-7 rounded-full transition flex-shrink-0 ${emailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emailEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {emailEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Email Provider API Key Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={20} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Email Provider API Key</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Ginagamit ito para sa pagpapadala ng email campaigns. Kung wala ito, hindi magagana ang Campaigns tab.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            emailKeyStatus === 'configured' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {emailKeyStatus === 'configured' ? 'Configured' : 'Not Set'}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={emailKey}
            onChange={e => setEmailKey(e.target.value)}
            placeholder={emailKeyStatus === 'configured' ? 'Enter new key to replace' : 'Enter email provider API key'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
          />
          <button
            onClick={async () => {
              if (!emailKey.trim()) return;
              setEmailKeySaving(true);
              const { error } = await supabase.from('platform_settings').upsert({
                key: 'EMAIL_PROVIDER_KEY',
                value: emailKey.trim(),
                updated_by: profile?.id,
              });
              setEmailKeySaving(false);
              if (error) { alert('Error: ' + error.message); return; }
              setEmailKey('');
              setEmailKeyStatus('configured');
              setSuccess('Nai-save ang email provider API key!');
              setTimeout(() => setSuccess(null), 3000);
              loadEmailKey();
            }}
            disabled={emailKeySaving || !emailKey.trim()}
            className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {emailKeySaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {emailKeySaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* QR Codes Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-brand-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Payment QR Codes</h3>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition"
          >
            <Plus size={14} />
            Add QR
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Mag-upload ng maraming QR codes (GCash, Maya, bank transfer, atbp). I-toggle kung alin ang kasalukuyang ginagamit — iyon ang lalabas sa billing page ng mga seller.
        </p>

        {qrCodes.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">Wala pang QR codes. Magdagdag ng isa.</p>
        ) : (
          <div className="space-y-3">
            {qrCodes.map(qr => (
              <div key={qr.id} className={`rounded-xl border-2 p-3 transition ${qr.is_active ? 'border-green-300 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={qr.image_url} alt={qr.label} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{qr.label}</p>
                    <p className="text-xs text-gray-400">{new Date(qr.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    {qr.is_active && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mt-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => toggleActiveQr(qr)}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        qr.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'
                      }`}
                    >
                      <Power size={12} />
                      {qr.is_active ? 'Off' : 'On'}
                    </button>
                    <button
                      onClick={() => deleteQr(qr)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-2 rounded-lg mt-3">
            <Check size={16} /> {success}
          </div>
        )}
      </div>

      {/* Add QR Code Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Bagong QR Code</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Label (Hal. GCash, Maya, BPI)</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="GCash"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <ImageUploadField
                label="QR Code Image"
                value={newImageUrl}
                onChange={setNewImageUrl}
                bucket="store-images"
                folder="admin-qr"
                aspectClass="h-40"
                cropAspect={1}
                hint="PNG o JPG. Makikita ito ng mga seller sa billing page nila."
              />
              <button
                onClick={addQrCode}
                disabled={saving || !newLabel.trim() || !newImageUrl.trim()}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Nagsasave...' : 'I-save ang QR Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= ADMIN MESSAGES TAB =============
function AdminMessagesTab({ onOpenChat }: { onOpenChat: (conversationId: string, name: string, userId: string) => void }) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<(AdminConversation & { user: { full_name: string; email: string; role: string; avatar_url: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMessages, setLastMessages] = useState<Record<string, { body: string; created_at: string; unread: boolean }>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('admin_conversations')
      .select('*, user:profiles!admin_conversations_user_id_fkey(full_name, email, role, avatar_url)')
      .eq('admin_id', profile.id)
      .order('updated_at', { ascending: false });
    const convs = (data || []) as any[];
    setConversations(convs);
    setLoading(false);

    const msgMap: Record<string, { body: string; created_at: string; unread: boolean }> = {};
    await Promise.all(convs.map(async (c: AdminConversation) => {
      const { data: msgs } = await supabase
        .from('admin_messages')
        .select('*')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) {
        const last = msgs[0] as any;
        msgMap[c.id] = {
          body: last.body,
          created_at: last.created_at,
          unread: last.sender_id !== profile.id && !last.read_at,
        };
      }
    }));
    setLastMessages(msgMap);
  }, [profile]);

  useEffect(() => {
    load();
    const sub = supabase.channel('admin-messages-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <MessageCircle size={20} className="text-gray-700" />
        Support Messages
      </h2>

      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <MessageCircle size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">Wala pang conversations.</p>
          <p className="text-gray-400 text-xs mt-1">Pumunta sa Users tab para mag-chat sa sinumang user.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => {
            const last = lastMessages[c.id];
            return (
              <button
                key={c.id}
                onClick={() => onOpenChat(c.id, c.user?.full_name || 'User', c.user_id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 text-left active:scale-[0.98] transition"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {c.user?.avatar_url ? (
                    <img src={c.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-gray-400 font-bold text-sm">
                      {(c.user?.full_name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-gray-800 truncate">{c.user?.full_name || 'User'}</p>
                    {last && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {new Date(last.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{c.user?.email}</p>
                  {last ? (
                    <p className={`text-xs mt-0.5 truncate ${last.unread ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                      {last.body}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-0.5">Magsimula ng usapan</p>
                  )}
                </div>
                {last?.unread && (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= VIDEO CREDITS APPROVAL =============
function VideoCreditsTab({ onPendingCountChange }: { onPendingCountChange: (count: number) => void }) {
  const [purchases, setPurchases] = useState<(VideoCreditPurchase & { user: { full_name: string; email: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_credit_purchases')
        .select('*, user:profiles!video_credit_purchases_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Error loading purchases: ' + error.message, 'error');
      }
      const loadedPurchases = (data || []) as any[];
      setPurchases(loadedPurchases);
      onPendingCountChange(loadedPurchases.filter(p => p.status === 'pending').length);
    } catch (err: any) {
      showToast('Error loading purchases: ' + (err?.message || 'Hindi ma-load.'), 'error');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const sub = supabase.channel('admin-video-credits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_credit_purchases' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [onPendingCountChange]);

  async function approve(id: string) {
    try {
      const { error } = await supabase.rpc('approve_video_credit_purchase', { purchase_id: id });
      if (error) {
        showToast('Error approving: ' + error.message, 'error');
        return;
      }
      showToast('Na-approve na ang top-up request!', 'success');
      load();
    } catch (err: any) {
      showToast('Error approving: ' + (err?.message || 'Hindi matapos ang approval.'), 'error');
    }
  }

  async function confirmReject(id: string) {
    if (!rejectReason.trim()) {
      showToast('Ilagay ang dahilan ng pag-reject.', 'error');
      return;
    }
    setRejecting(true);
    try {
      const { error } = await supabase.rpc('reject_video_credit_purchase', {
        purchase_id: id,
        p_rejection_reason: rejectReason.trim(),
      });
      setRejecting(false);
      if (error) {
        showToast('Error rejecting: ' + error.message, 'error');
        return;
      }
      showToast('Na-reject ang top-up request.', 'success');
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      setRejecting(false);
      showToast('Error rejecting: ' + (err?.message || 'Hindi matapos ang reject.'), 'error');
    }
  }

  const filtered = purchases.filter(p => filter === 'all' ? true : p.status === filter);
  const pendingCount = purchases.filter(p => p.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 relative">
      <div className="flex items-center gap-2 mb-4">
        <Coins size={22} className="text-brand-600" />
        <h2 className="text-lg font-bold text-gray-800">Video Credit Top-up Requests</h2>
      </div>

      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {pendingCount} request{pendingCount > 1 ? 's' : ''} na naghihintay ng approval.
          </p>
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {f === 'all' ? 'Lahat' : f === 'pending' ? 'Pending' : f === 'approved' ? 'Approved' : 'Rejected'}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Coins size={40} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No {filter === 'all' ? 'purchases' : filter + ' requests'} yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              {/* User info + status badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-600 font-bold text-sm">
                      {(p.user?.full_name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.user?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 truncate">{p.user?.email}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                  p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  p.status === 'approved' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {p.status === 'pending' ? 'Pending' : p.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">Package</p>
                  <p className="font-bold text-gray-700">{p.credits} credits</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">Amount</p>
                  <p className="font-bold text-gray-700">₱{Number(p.amount_paid || 0).toFixed(0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 mb-0.5">Date</p>
                  <p className="font-bold text-gray-700">
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Reference number */}
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                <Receipt size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">Ref:</span>
                <span className="font-mono font-medium text-gray-700 truncate">{p.reference_number}</span>
              </div>

              {/* Screenshot thumbnail — legacy: only shown if a purchase has one.
                  New purchases no longer require a screenshot; reference number only. */}
              {p.screenshot_url && p.status === 'pending' && (
                <div className="mb-3">
                  <button
                    onClick={() => setLightboxUrl(p.screenshot_url!)}
                    className="block max-w-md w-full rounded-xl overflow-hidden border border-gray-200 active:scale-[0.98] transition relative group"
                  >
                    <img
                      src={p.screenshot_url}
                      alt="Payment screenshot"
                      className="w-full h-28 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition bg-white/90 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <Receipt size={14} /> View full image
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Rejection reason (if rejected) */}
              {p.status === 'rejected' && p.rejection_reason && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dahilan ng pag-reject:</p>
                    <p className="text-red-500">{p.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Approve info (if approved) */}
              {p.status === 'approved' && p.approved_at && (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
                  <Check size={14} className="flex-shrink-0" />
                  <span>Na-approve noong {p.approved_at ? new Date(p.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A'}</span>
                </div>
              )}

              {/* Action buttons for pending */}
              {p.status === 'pending' && rejectingId !== p.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(p.id)}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} /> I-approve
                  </button>
                  <button
                    onClick={() => { setRejectingId(p.id); setRejectReason(''); }}
                    className="flex-1 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <X size={16} /> I-reject
                  </button>
                </div>
              )}

              {/* Rejection reason input */}
              {p.status === 'pending' && rejectingId === p.id && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                      Dahilan ng pag-reject
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Halimbawa: Maling reference number, Hindi pumasok ang pera..."
                      rows={2}
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmReject(p.id)}
                      disabled={rejecting}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {rejecting ? (
                        <><Loader2 size={16} className="animate-spin" /> Nagse-submit...</>
                      ) : (
                        <><Check size={16} /> Kumpirmahin ang Reject</>
                      )}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-95 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Screenshot lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <X size={24} className="text-white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Payment screenshot"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============= TUTORIALS TAB =============
type TutorialVideo = {
  id: string;
  youtube_url: string;
  youtube_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function extractYouTubeId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return '';
}

function TutorialsTab() {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tutorial_videos')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setVideos((data || []) as TutorialVideo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setUrl('');
    setTitle('');
    setDescription('');
    setEditingId(null);
    setError(null);
    setShowForm(false);
  }

  function startEdit(v: TutorialVideo) {
    setUrl(v.youtube_url);
    setTitle(v.title);
    setDescription(v.description || '');
    setEditingId(v.id);
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();
    if (!trimmedUrl || !trimmedTitle) {
      setError('Kailangan ng YouTube link at title.');
      return;
    }
    const ytId = extractYouTubeId(trimmedUrl);
    if (!ytId) {
      setError('Hindi wastong YouTube link. Ilagay ang buong URL (hal. https://www.youtube.com/watch?v=...).');
      return;
    }
    setSaving(true);
    setError(null);

    if (editingId) {
      const { error: err } = await supabase
        .from('tutorial_videos')
        .update({
          youtube_url: trimmedUrl,
          youtube_id: ytId,
          title: trimmedTitle,
          description: description.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (err) setError('Error: ' + err.message);
    } else {
      const maxSort = videos.length > 0 ? Math.max(...videos.map(v => v.sort_order)) : 0;
      const { error: err } = await supabase
        .from('tutorial_videos')
        .insert({
          youtube_url: trimmedUrl,
          youtube_id: ytId,
          title: trimmedTitle,
          description: description.trim(),
          sort_order: maxSort + 1,
        });
      if (err) setError('Error: ' + err.message);
    }

    setSaving(false);
    if (!error) {
      resetForm();
      load();
    }
  }

  async function toggleActive(v: TutorialVideo) {
    await supabase.from('tutorial_videos').update({ is_active: !v.is_active }).eq('id', v.id);
    load();
  }

  async function deleteVideo(v: TutorialVideo) {
    if (!confirm(`Sigurado ka bang burahin ang "${v.title}"?`)) return;
    await supabase.from('tutorial_videos').delete().eq('id', v.id);
    load();
  }

  async function moveVideo(v: TutorialVideo, direction: 'up' | 'down') {
    const idx = videos.findIndex(x => x.id === v.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === videos.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const other = videos[swapIdx];
    await Promise.all([
      supabase.from('tutorial_videos').update({ sort_order: other.sort_order }).eq('id', v.id),
      supabase.from('tutorial_videos').update({ sort_order: v.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Tutorial Videos</h2>
          <p className="text-xs text-gray-400">Magdagdag ng YouTube video tutorials na makikita ng users sa tutorial page.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
        >
          <Plus size={16} /> Bagong Video
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => { resetForm(); }}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{editingId ? 'I-edit ang Video' : 'Bagong Tutorial Video'}</h3>
              <button onClick={() => resetForm()} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">YouTube Link</label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Hal. Paano mag-order bilang Buyer"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Maikling paglalarawan ng video..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !url.trim() || !title.trim()}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Nagsasave...' : editingId ? 'I-save ang Pagbabago' : 'I-add ang Video'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <PlayCircle size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">Wala pang tutorial videos.</p>
          <p className="text-gray-400 text-xs mt-1">Magdagdag ng YouTube video para makita ng users sa tutorial page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v, idx) => (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="relative w-full sm:w-40 aspect-video sm:aspect-auto sm:h-28 bg-black flex-shrink-0">
                  <img
                    src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                    alt={v.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 rounded-lg px-2 py-0.5">
                    #{idx + 1}
                  </span>
                </div>

                {/* Info + Actions */}
                <div className="flex-1 p-3 flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-800 leading-snug">{v.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {v.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                    {v.description && (
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mt-1">{v.description}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => startEdit(v)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 active:scale-95 transition"
                    >
                      <Eye size={14} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(v)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium active:scale-95 transition ${
                        v.is_active ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {v.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                      {v.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => moveVideo(v, 'up')}
                      disabled={idx === 0}
                      className="flex items-center justify-center w-9 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 active:scale-95 transition disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveVideo(v, 'down')}
                      disabled={idx === videos.length - 1}
                      className="flex items-center justify-center w-9 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 active:scale-95 transition disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => deleteVideo(v)}
                      className="flex items-center justify-center w-9 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-500 active:scale-95 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= AFFILIATES =============
interface AdminAffiliate {
  id: string;
  email: string;
  full_name: string;
  payout_qr_url: string;
  referral_code: string;
  wallet_balance: number;
  lifetime_earnings: number;
  tier1_earnings: number;
  tier2_earnings: number;
  sponsor_id: string | null;
  payout_status: string;
  payout_requested_at: string | null;
  created_at: string;
}

interface AdminReferral {
  id: string;
  referred_name: string;
  referred_role: string;
  accumulated_admin_collected: number;
  milestones_hit: number;
  total_commission_earned: number;
}

function AffiliatesTab() {
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([]);
  const [referrals, setReferrals] = useState<Record<string, AdminReferral[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAff, setSelectedAff] = useState<AdminAffiliate | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: affData } = await supabase
      .from('affiliates')
      .select('*')
      .order('created_at', { ascending: false });
    const affs = (affData || []) as AdminAffiliate[];
    setAffiliates(affs);

    if (affs.length > 0) {
      const { data: refData } = await supabase
        .from('affiliate_referrals')
        .select('*')
        .in('affiliate_id', affs.map(a => a.id));
      const refMap: Record<string, AdminReferral[]> = {};
      (refData || []).forEach((r: any) => {
        if (!refMap[r.affiliate_id]) refMap[r.affiliate_id] = [];
        refMap[r.affiliate_id].push(r);
      });
      setReferrals(refMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase.channel('admin-affiliates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliates' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  async function processPayout(aff: AdminAffiliate) {
    setProcessing(aff.id);
    const amount = Number(aff.wallet_balance);
    await supabase.from('affiliate_transactions').insert({
      affiliate_id: aff.id,
      type: 'payout',
      description: `Payout processed by admin - ₱${amount.toFixed(2)}`,
      amount,
      status: 'paid',
    });
    await supabase
      .from('affiliates')
      .update({
        wallet_balance: 0,
        payout_status: 'paid',
        payout_requested_at: null,
      })
      .eq('id', aff.id);
    setProcessing(null);
    setSelectedAff(null);
    load();
  }

  async function rejectPayout(aff: AdminAffiliate) {
    setProcessing(aff.id);
    await supabase
      .from('affiliates')
      .update({ payout_status: 'none', payout_requested_at: null })
      .eq('id', aff.id);
    setProcessing(null);
    setSelectedAff(null);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const totalAffiliates = affiliates.length;
  const totalWalletOutstanding = affiliates.reduce((s, a) => s + Number(a.wallet_balance || 0), 0);
  const totalLifetimePayouts = affiliates.reduce((s, a) => s + Number(a.lifetime_earnings || 0), 0);
  const pendingPayouts = affiliates.filter(a => a.payout_status === 'requested');

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-2">
            <Users size={20} className="text-white" />
          </div>
          <p className="text-xs text-gray-400">Total Affiliates</p>
          <p className="text-lg font-bold text-gray-800">{totalAffiliates}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-2">
            <Wallet size={20} className="text-white" />
          </div>
          <p className="text-xs text-gray-400">Wallet Outstanding</p>
          <p className="text-lg font-bold text-gray-800">₱{totalWalletOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-2">
            <TrendingUp size={20} className="text-white" />
          </div>
          <p className="text-xs text-gray-400">Lifetime Earnings</p>
          <p className="text-lg font-bold text-gray-800">₱{totalLifetimePayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {pendingPayouts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-600" />
            <h3 className="font-bold text-amber-800 text-sm">Payout Requests ({pendingPayouts.length})</h3>
          </div>
          <div className="space-y-2">
            {pendingPayouts.map(aff => (
              <div key={aff.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{aff.full_name}</p>
                  <p className="text-xs text-gray-400">{aff.email} · ₱{Number(aff.wallet_balance).toFixed(2)}</p>
                  {aff.payout_requested_at && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(aff.payout_requested_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => processPayout(aff)}
                    disabled={processing === aff.id}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                  >
                    {processing === aff.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Pay
                  </button>
                  <button
                    onClick={() => rejectPayout(aff)}
                    disabled={processing === aff.id}
                    className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold border border-red-200 active:scale-95 transition disabled:opacity-50"
                  >
                    <X size={12} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="font-bold text-gray-800 text-sm">All Affiliates</h3>
        </div>
        {affiliates.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang affiliates.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {affiliates.map(aff => {
              const affRefs = referrals[aff.id] || [];
              const sellerCount = affRefs.filter(r => r.referred_role === 'seller').length;
              const riderCount = affRefs.filter(r => r.referred_role === 'rider').length;
              const totalMilestones = affRefs.reduce((s, r) => s + r.milestones_hit, 0);
              return (
                <div key={aff.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-800 truncate">{aff.full_name}</p>
                      {aff.payout_status === 'requested' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Payout Requested</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{aff.email} · Code: {aff.referral_code}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-gray-500">Wallet: ₱{Number(aff.wallet_balance).toFixed(0)}</span>
                      <span className="text-[10px] text-gray-500">Sellers: {sellerCount}</span>
                      <span className="text-[10px] text-gray-500">Riders: {riderCount}</span>
                      <span className="text-[10px] text-gray-500">Milestones: {totalMilestones}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAff(aff)}
                    className="flex-shrink-0 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold active:scale-95 transition"
                  >
                    <Eye size={14} className="inline mr-1" /> View
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedAff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAff(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Affiliate Details</h3>
              <button onClick={() => setSelectedAff(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-400">Name</p>
                <p className="font-semibold text-gray-800">{selectedAff.full_name}</p>
                <p className="text-xs text-gray-400 mt-1">{selectedAff.email}</p>
                <p className="text-xs text-gray-400">Referral Code: <span className="font-mono font-bold text-gray-700">{selectedAff.referral_code}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Wallet Balance</p>
                  <p className="text-lg font-bold text-green-700">₱{Number(selectedAff.wallet_balance).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Lifetime Earnings</p>
                  <p className="text-lg font-bold text-blue-700">₱{Number(selectedAff.lifetime_earnings).toFixed(2)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                  <p className="text-xs text-gray-400">Tier 1 (Direktang Kita)</p>
                  <p className="text-sm font-bold text-green-700">₱{Number(selectedAff.tier1_earnings || 0).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-xs text-gray-400">Tier 2 (Kita sa 2nd Level Affiliates)</p>
                  <p className="text-sm font-bold text-blue-700">₱{Number(selectedAff.tier2_earnings || 0).toFixed(2)}</p>
                </div>
              </div>
              {selectedAff.sponsor_id && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Sponsor (Parent Affiliate)</p>
                  <p className="text-sm font-medium text-gray-700">{affiliates.find(a => a.id === selectedAff.sponsor_id)?.full_name || 'Linked Affiliate'}</p>
                </div>
              )}
              {selectedAff.payout_qr_url ? (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Payout QR Code</p>
                  <div className="flex justify-center">
                    <img src={selectedAff.payout_qr_url} alt="Payout QR" className="w-40 h-40 rounded-xl object-cover border border-gray-100" />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center bg-gray-50 rounded-xl p-3">Wala pang QR code na na-upload.</p>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Referrals ({(referrals[selectedAff.id] || []).length})</p>
                {(referrals[selectedAff.id] || []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">Wala pang referrals.</p>
                ) : (
                  <div className="space-y-2">
                    {(referrals[selectedAff.id] || []).map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{r.referred_name}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{r.referred_role} · {r.milestones_hit} milestones · ₱{Number(r.total_commission_earned).toFixed(0)} earned</p>
                        </div>
                        <span className="text-xs font-bold text-gray-600">₱{Number(r.accumulated_admin_collected).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedAff.payout_status === 'requested' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => processPayout(selectedAff)}
                    disabled={processing === selectedAff.id}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processing === selectedAff.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Process Payout
                  </button>
                  <button
                    onClick={() => rejectPayout(selectedAff)}
                    disabled={processing === selectedAff.id}
                    className="py-2.5 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-200 active:scale-95 transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}