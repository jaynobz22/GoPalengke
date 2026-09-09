import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Announcement, Profile, FeePayment, UserRole, SellerFee, AdminCall, AdminConversation } from '@/lib/types';
import { ImageUploadField } from '@/components/ImageUploadField';
import { AdminVideoCall } from '@/components/AdminVideoCall';
import { AdminChat, getOrCreateAdminConversation } from '@/components/AdminChat';
import {
  Megaphone, Plus, Trash2, Power, Check, Loader2, LogOut,
  Store as StoreIcon, ShoppingBag, Bike, Users, Wallet, Settings,
  AlertCircle, X, UserCheck, UserX, DollarSign, TrendingUp, Receipt,
  Lock, Unlock, Video, MessageCircle, Shield, QrCode,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'messages' | 'fees' | 'announcements' | 'settings';

export function AdminApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [activeCall, setActiveCall] = useState<{ roomId: string; isCaller: boolean; callId: string; otherName: string } | null>(null);
  const [activeChat, setActiveChat] = useState<{ conversationId: string; otherName: string } | null>(null);

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
      setActiveChat({ conversationId: convId, otherName: user.full_name });
    }
  }

  function endAdminChat() {
    setActiveChat(null);
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'fees', label: 'Fees', icon: Wallet },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-10 h-10 rounded-xl object-cover" />
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
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[80px] flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition ${
                active ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-400'
              }`}
            >
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab onStartCall={startAdminCall} onStartChat={startAdminChat} />}
      {tab === 'messages' && <AdminMessagesTab onOpenChat={(convId, name) => setActiveChat({ conversationId: convId, otherName: name })} />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'settings' && <SettingsTab />}

      {activeChat && profile && (
        <AdminChat
          conversationId={activeChat.conversationId}
          currentUserId={profile.id}
          otherName={activeChat.otherName}
          isAdmin={true}
          onBack={endAdminChat}
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
    pendingApprovals: 0, pendingPayments: 0, frozenSellers: 0,
    totalCommission: 0, totalSubscription: 0, totalPlatformEarnings: 0,
    unverifiedStores: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [stores, products, buyers, riders, sellers, orders, pendingApprovals, pendingPayments, sellerFees, frozenCount, unverifiedStores] = await Promise.all([
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
      ]);

      const fees = (sellerFees.data || []) as any[];
      const totalCommission = fees.reduce((s, f) => s + (f.commission_balance || 0), 0);
      const totalSubscription = fees.reduce((s, f) => s + (f.subscription_balance || 0), 0);

      setStats({
        stores: stores.count || 0,
        products: products.count || 0,
        buyers: buyers.count || 0,
        riders: riders.count || 0,
        sellers: sellers.count || 0,
        orders: orders.count || 0,
        pendingApprovals: pendingApprovals.count || 0,
        pendingPayments: pendingPayments.count || 0,
        frozenSellers: frozenCount.count || 0,
        totalCommission,
        totalSubscription,
        totalPlatformEarnings: totalCommission + totalSubscription,
        unverifiedStores: unverifiedStores.data || [],
      });
      setLoading(false);
    }
    load();

    // Realtime: reload when seller_fees or orders change so platform earnings stay live
    const sub = supabase.channel('admin-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_fees' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
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
            May {stats.pendingPayments} payment na naghihintay ng approval.
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
                    await supabase.from('stores').update({ is_verified: true }).eq('id', s.id);
                    setStats(prev => ({ ...prev, unverifiedStores: prev.unverifiedStores.filter((st: any) => st.id !== s.id) }));
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
          <span>Subscription: ₱{stats.totalSubscription.toFixed(2)}</span>
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
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: user.id,
      p_admin_id: adminProfile.id,
    });
    setDeleting(null);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      load();
    }
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

              {/* Chat + Video Call + Delete */}
              {user.id !== adminProfile?.id && (
                <div className="flex gap-2 mt-2">
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
    </div>
  );
}

// ============= FEES TAB =============
function FeesTab() {
  const { profile: adminProfile } = useAuth();
  const [payments, setPayments] = useState<(FeePayment & { seller: { full_name: string; email: string } })[]>([]);
  const [frozenSellers, setFrozenSellers] = useState<(SellerFee & { seller: { full_name: string; email: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [payData, frozenData] = await Promise.all([
      supabase
        .from('fee_payments')
        .select('*, seller:profiles!fee_payments_seller_id_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('seller_fees')
        .select('*, seller:profiles!seller_fees_seller_id_fkey(full_name, email)')
        .not('frozen_at', 'is', null)
        .order('frozen_at', { ascending: false }),
    ]);
    setPayments((payData.data || []) as any);
    setFrozenSellers((frozenData.data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approvePayment(payment: FeePayment) {
    if (!adminProfile) return;
    setProcessing(payment.id);
    const { error } = await supabase.rpc('approve_fee_payment', {
      p_payment_id: payment.id,
      p_admin_id: adminProfile.id,
    });
    if (error) {
      alert('Error: ' + error.message);
    }
    setProcessing(null);
    load();
  }

  async function rejectPayment(payment: FeePayment) {
    if (!confirm('Sigurado ka bang gusto mong i-reject ang payment na ito?')) return;
    setProcessing(payment.id);
    await supabase.from('fee_payments').update({ status: 'rejected' }).eq('id', payment.id);
    setProcessing(null);
    load();
  }

  async function reactivateSeller(sellerId: string) {
    if (!confirm('Sigurado ka bang gusto mong i-reactivate ang seller na ito? Titiyakin na nakapagbayad na siya.')) return;
    setReactivating(sellerId);
    const { error } = await supabase.rpc('reactivate_seller', { p_seller_id: sellerId });
    if (error) {
      alert('Error: ' + error.message);
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
                <p className="font-bold text-lg text-gray-800">₱{p.amount.toFixed(2)}</p>
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
                  <p className="font-bold text-lg text-red-600">₱{(f.total_payable || 0).toFixed(2)}</p>
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
        <div className="space-y-2">
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
                <p className="font-semibold text-sm text-gray-700">₱{p.amount.toFixed(2)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
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
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{newMessage.length}/200</span>
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

  const load = useCallback(async () => {
    const { data } = await supabase.from('platform_qr_codes').select('*').order('created_at', { ascending: false });
    setQrCodes((data || []) as PlatformQrCode[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
function AdminMessagesTab({ onOpenChat }: { onOpenChat: (conversationId: string, name: string) => void }) {
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
                onClick={() => onOpenChat(c.id, c.user?.full_name || 'User')}
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
