import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Announcement } from '@/lib/types';
import {
  Megaphone, Plus, Trash2, Power, Check, Loader2, Fish, LogOut,
  Store as StoreIcon, ShoppingBag, Bike, Users,
} from 'lucide-react';

type Tab = 'overview' | 'announcements';

export function AdminApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Fish size={22} className="text-white" />
          </div>
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
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {[
          { id: 'overview' as Tab, label: 'Overview', icon: Users },
          { id: 'announcements' as Tab, label: 'Announcements', icon: Megaphone },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
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
      {tab === 'announcements' && <AnnouncementsTab />}
    </div>
  );
}

// ============= OVERVIEW =============
function OverviewTab() {
  const [stats, setStats] = useState({ stores: 0, products: 0, buyers: 0, riders: 0, orders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [stores, products, buyers, riders, orders] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'buyer'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'rider'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        stores: stores.count || 0,
        products: products.count || 0,
        buyers: buyers.count || 0,
        riders: riders.count || 0,
        orders: orders.count || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { icon: StoreIcon, label: 'Tindahan', value: stats.stores, color: 'bg-orange-50 text-orange-600' },
    { icon: ShoppingBag, label: 'Paninda', value: stats.products, color: 'bg-brand-50 text-brand-600' },
    { icon: Users, label: 'Mamimili', value: stats.buyers, color: 'bg-green-50 text-green-600' },
    { icon: Bike, label: 'Riders', value: stats.riders, color: 'bg-blue-50 text-blue-600' },
    { icon: ShoppingBag, label: 'Orders', value: stats.orders, color: 'bg-purple-50 text-purple-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Overview</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center mb-2`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          );
        })}
      </div>
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

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements((data || []) as Announcement[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Deactivate all existing, then insert new one as active
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
      // Deactivating this one
      await supabase.from('announcements').update({ is_active: false }).eq('id', id);
    } else {
      // Activating this one — deactivate all others first
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
      {/* New Announcement Form */}
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

      {/* Current Live Announcement Preview */}
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

      {/* Announcement History */}
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
            <div
              key={a.id}
              className={`bg-white rounded-2xl border p-4 ${a.is_active ? 'border-green-200' : 'border-gray-100'}`}
            >
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
                      a.is_active
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-50 text-green-600'
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
