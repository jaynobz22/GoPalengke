import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Store as StoreIcon, Bike, ShoppingBag, MapPin, TrendingUp,
  Trophy, Crown, Medal, BarChart3, Calendar, DollarSign, Package,
  ArrowUp, ArrowDown, ChevronRight,
} from 'lucide-react';

type SubTab = 'sellers' | 'riders' | 'buyers' | 'geographic';
type Period = 'daily' | 'weekly' | 'monthly';

interface SellerStat {
  store_id: string;
  store_name: string;
  seller_name: string;
  palengke_name: string | null;
  city: string | null;
  region: string | null;
  order_count: number;
  total_volume: number;
  total_commission: number;
}

interface RiderStat {
  rider_id: string;
  rider_name: string;
  email: string;
  barangay: string | null;
  city: string | null;
  deliveries: number;
  total_earnings: number;
  completed: number;
  cancelled: number;
}

interface BuyerStat {
  buyer_id: string;
  buyer_name: string;
  email: string;
  barangay: string | null;
  city: string | null;
  order_count: number;
  total_spent: number;
}

interface GeoStat {
  name: string;
  order_count: number;
  total_volume: number;
  store_count: number;
}

interface PeriodData {
  date: string;
  orders: number;
  volume: number;
}

export function AnalyticsDashboard() {
  const [subTab, setSubTab] = useState<SubTab>('sellers');
  const [period, setPeriod] = useState<Period>('daily');

  const tabs: { id: SubTab; label: string; icon: typeof StoreIcon }[] = [
    { id: 'sellers', label: 'Sellers', icon: StoreIcon },
    { id: 'riders', label: 'Riders', icon: Bike },
    { id: 'buyers', label: 'Buyers', icon: ShoppingBag },
    { id: 'geographic', label: 'Geographic', icon: MapPin },
  ];

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={22} className="text-brand-600" />
        <h2 className="text-lg font-bold text-gray-800">Analytics Dashboard</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                active ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Period selector for sellers/geographic */}
      {(subTab === 'sellers' || subTab === 'geographic') && (
        <div className="flex gap-2 mb-4">
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                period === p ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <Calendar size={12} />
              {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      )}

      {subTab === 'sellers' && <SellerAnalytics period={period} />}
      {subTab === 'riders' && <RiderAnalytics />}
      {subTab === 'buyers' && <BuyerAnalytics />}
      {subTab === 'geographic' && <GeographicAnalytics period={period} />}
    </div>
  );
}

// ============= SELLER ANALYTICS =============
function SellerAnalytics({ period }: { period: Period }) {
  const [topSellers, setTopSellers] = useState<SellerStat[]>([]);
  const [trendData, setTrendData] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string;
    let groupFormat: string;

    if (period === 'daily') {
      startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
      groupFormat = 'YYYY-MM-DD';
    } else if (period === 'weekly') {
      startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString();
      groupFormat = 'IYYY-IW';
    } else {
      startDate = new Date(now.getTime() - 11 * 30 * 24 * 60 * 60 * 1000).toISOString();
      groupFormat = 'YYYY-MM';
    }

    const [sellersRes, trendRes] = await Promise.all([
      supabase.from('orders')
        .select(`
          store_id,
          total,
          commission_amount,
          status,
          created_at,
          store:stores!orders_store_id_fkey(name, palengke_name, city, region, seller:profiles!stores_seller_id_fkey(full_name))
        `)
        .neq('status', 'cancelled')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_order_trend', { p_start: startDate, p_format: groupFormat }),
    ]);

    // Aggregate by store
    const storeMap: Record<string, SellerStat> = {};
    for (const o of (sellersRes.data || []) as any[]) {
      const sid = o.store_id;
      if (!storeMap[sid]) {
        storeMap[sid] = {
          store_id: sid,
          store_name: o.store?.name || 'Unknown',
          seller_name: o.store?.seller?.full_name || 'Unknown',
          palengke_name: o.store?.palengke_name || null,
          city: o.store?.city || null,
          region: o.store?.region || null,
          order_count: 0,
          total_volume: 0,
          total_commission: 0,
        };
      }
      storeMap[sid].order_count++;
      storeMap[sid].total_volume += Number(o.total) || 0;
      storeMap[sid].total_commission += Number(o.commission_amount) || 0;
    }

    const sorted = Object.values(storeMap).sort((a, b) => b.total_volume - a.total_volume).slice(0, 15);
    setTopSellers(sorted);
    setTrendData((trendRes.data || []) as any[]);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const maxVolume = Math.max(...topSellers.map(s => s.total_volume), 1);
  const maxTrend = Math.max(...trendData.map(t => t.volume), 1);

  return (
    <div className="space-y-4">
      {/* Trend Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-gray-800">Order Volume Trend ({period})</h3>
        </div>
        {trendData.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang data para sa period na ito.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {trendData.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full relative flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className="w-full max-w-[24px] bg-gradient-to-t from-brand-500 to-brand-400 rounded-t-md transition-all duration-300 group-hover:from-brand-600 group-hover:to-brand-500"
                    style={{ height: `${(t.volume / maxTrend) * 100}%` }}
                  />
                  <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                      ₱{t.volume.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <span className="text-[8px] text-gray-400 truncate w-full text-center">{t.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 15 Sellers Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h3 className="font-semibold text-sm text-gray-800">Top 15 Sellers by Volume</h3>
        </div>
        {topSellers.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang order data.</p>
        ) : (
          <div className="space-y-2">
            {topSellers.map((s, i) => (
              <SellerRow key={s.store_id} rank={i + 1} seller={s} maxVolume={maxVolume} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SellerRow({ rank, seller, maxVolume }: { rank: number; seller: SellerStat; maxVolume: number }) {
  const pct = (seller.total_volume / maxVolume) * 100;
  const rankIcon = rank === 1 ? <Crown size={16} className="text-amber-500" /> : rank === 2 ? <Medal size={16} className="text-gray-400" /> : rank === 3 ? <Medal size={16} className="text-amber-700" /> : <span className="text-xs font-bold text-gray-400">{rank}</span>;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        {rankIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-semibold text-sm text-gray-800 truncate">{seller.store_name}</p>
          <span className="text-xs font-bold text-gray-700 flex-shrink-0">₱{seller.total_volume.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs text-gray-400 truncate">{seller.seller_name}</p>
          {seller.palengke_name && <span className="text-xs text-gray-300">·</span>}
          {seller.palengke_name && <p className="text-xs text-gray-400 truncate">{seller.palengke_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{seller.order_count} orders</span>
        </div>
      </div>
    </div>
  );
}

// ============= RIDER ANALYTICS =============
function RiderAnalytics() {
  const [topRiders, setTopRiders] = useState<RiderStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('orders')
        .select(`
          rider_id,
          status,
          delivery_fee,
          created_at,
          rider:profiles!orders_rider_id_fkey(full_name, email, barangay, city)
        `)
        .not('rider_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      const riderMap: Record<string, RiderStat> = {};
      for (const o of (data || []) as any[]) {
        const rid = o.rider_id;
        if (!rid) continue;
        if (!riderMap[rid]) {
          riderMap[rid] = {
            rider_id: rid,
            rider_name: o.rider?.full_name || 'Unknown',
            email: o.rider?.email || '',
            barangay: o.rider?.barangay || null,
            city: o.rider?.city || null,
            deliveries: 0,
            total_earnings: 0,
            completed: 0,
            cancelled: 0,
          };
        }
        riderMap[rid].deliveries++;
        riderMap[rid].total_earnings += Number(o.delivery_fee) || 0;
        if (o.status === 'delivered') riderMap[rid].completed++;
        if (o.status === 'cancelled') riderMap[rid].cancelled++;
      }

      const sorted = Object.values(riderMap).sort((a, b) => b.deliveries - a.deliveries).slice(0, 15);
      setTopRiders(sorted);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const maxDeliveries = Math.max(...topRiders.map(r => r.deliveries), 1);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h3 className="font-semibold text-sm text-gray-800">Top 15 Riders by Deliveries</h3>
        </div>
        {topRiders.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang rider activity.</p>
        ) : (
          <div className="space-y-2">
            {topRiders.map((r, i) => {
              const pct = (r.deliveries / maxDeliveries) * 100;
              const rankIcon = i === 0 ? <Crown size={16} className="text-amber-500" /> : i === 1 ? <Medal size={16} className="text-gray-400" /> : i === 2 ? <Medal size={16} className="text-amber-700" /> : <span className="text-xs font-bold text-gray-400">{i + 1}</span>;
              const completionRate = r.deliveries > 0 ? (r.completed / r.deliveries) * 100 : 0;
              return (
                <div key={r.rider_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {rankIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-800 truncate">{r.rider_name}</p>
                      <span className="text-xs font-bold text-gray-700 flex-shrink-0">{r.deliveries} deliveries</span>
                    </div>
                    <div className="flex items-center gap-3 mb-1.5">
                      {r.city && <p className="text-xs text-gray-400 truncate">{r.city}</p>}
                      <span className="text-xs text-gray-300">·</span>
                      <p className="text-xs text-gray-400">₱{r.total_earnings.toLocaleString('en-PH', { maximumFractionDigits: 0 })} earned</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{completionRate.toFixed(0)}% done</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= BUYER ANALYTICS =============
function BuyerAnalytics() {
  const [topBuyers, setTopBuyers] = useState<BuyerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('orders')
        .select(`
          buyer_id,
          total,
          status,
          buyer:profiles!orders_buyer_id_fkey(full_name, email, barangay, city)
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(500);

      const buyerMap: Record<string, BuyerStat> = {};
      for (const o of (data || []) as any[]) {
        const bid = o.buyer_id;
        if (!buyerMap[bid]) {
          buyerMap[bid] = {
            buyer_id: bid,
            buyer_name: o.buyer?.full_name || 'Unknown',
            email: o.buyer?.email || '',
            barangay: o.buyer?.barangay || null,
            city: o.buyer?.city || null,
            order_count: 0,
            total_spent: 0,
          };
        }
        buyerMap[bid].order_count++;
        buyerMap[bid].total_spent += Number(o.total) || 0;
      }

      const sorted = Object.values(buyerMap).sort((a, b) => b.total_spent - a.total_spent).slice(0, 15);
      setTopBuyers(sorted);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const maxSpent = Math.max(...topBuyers.map(b => b.total_spent), 1);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500" />
          <h3 className="font-semibold text-sm text-gray-800">Top 15 Buyers by Spending</h3>
        </div>
        {topBuyers.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang buyer activity.</p>
        ) : (
          <div className="space-y-2">
            {topBuyers.map((b, i) => {
              const pct = (b.total_spent / maxSpent) * 100;
              const rankIcon = i === 0 ? <Crown size={16} className="text-amber-500" /> : i === 1 ? <Medal size={16} className="text-gray-400" /> : i === 2 ? <Medal size={16} className="text-amber-700" /> : <span className="text-xs font-bold text-gray-400">{i + 1}</span>;
              return (
                <div key={b.buyer_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {rankIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-800 truncate">{b.buyer_name}</p>
                      <span className="text-xs font-bold text-gray-700 flex-shrink-0">₱{b.total_spent.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-1.5">
                      {b.city && <p className="text-xs text-gray-400 truncate">{b.city}</p>}
                      <span className="text-xs text-gray-300">·</span>
                      <p className="text-xs text-gray-400">{b.order_count} orders</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= GEOGRAPHIC ANALYTICS =============
function GeographicAnalytics({ period }: { period: Period }) {
  const [view, setView] = useState<'palengke' | 'city' | 'region'>('palengke');
  const [geoData, setGeoData] = useState<GeoStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let startDate: string;
    if (period === 'daily') startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === 'weekly') startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString();
    else startDate = new Date(now.getTime() - 11 * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase.from('orders')
      .select(`
        total,
        status,
        store:stores!orders_store_id_fkey(palengke_name, city, region)
      `)
      .neq('status', 'cancelled')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    const geoMap: Record<string, GeoStat> = {};
    for (const o of (data || []) as any[]) {
      let name = 'Unknown';
      if (view === 'palengke') name = o.store?.palengke_name || 'No Palengke';
      else if (view === 'city') name = o.store?.city || 'Unknown City';
      else name = o.store?.region || 'Unknown Region';

      if (!geoMap[name]) {
        geoMap[name] = { name, order_count: 0, total_volume: 0, store_count: 0 };
      }
      geoMap[name].order_count++;
      geoMap[name].total_volume += Number(o.total) || 0;
    }

    // Get store counts per area
    const storeCol = view === 'palengke' ? 'palengke_name' : view;
    const { data: storesData } = await supabase.from('stores').select(storeCol);
    for (const s of (storesData || []) as any[]) {
      const name = s[storeCol] || (view === 'palengke' ? 'No Palengke' : `Unknown ${view}`);
      if (geoMap[name]) geoMap[name].store_count++;
    }

    const sorted = Object.values(geoMap).sort((a, b) => b.total_volume - a.total_volume);
    setGeoData(sorted);
    setLoading(false);
  }, [period, view]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const maxVolume = Math.max(...geoData.map(g => g.total_volume), 1);

  const views: { id: 'palengke' | 'city' | 'region'; label: string }[] = [
    { id: 'palengke', label: 'Palengke' },
    { id: 'city', label: 'City' },
    { id: 'region', label: 'Region' },
  ];

  return (
    <div className="space-y-4">
      {/* View selector */}
      <div className="flex gap-2">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              view === v.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            <MapPin size={12} />
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-gray-800">Volume by {view} ({period})</h3>
        </div>
        {geoData.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Wala pang data para sa view na ito.</p>
        ) : (
          <div className="space-y-2">
            {geoData.slice(0, 20).map((g, i) => {
              const pct = (g.total_volume / maxVolume) * 100;
              return (
                <div key={g.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                  <span className="text-xs font-bold text-gray-400 w-6 text-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-800 truncate">{g.name}</p>
                      <span className="text-xs font-bold text-gray-700 flex-shrink-0">₱{g.total_volume.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{g.order_count} orders · {g.store_count} stores</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
