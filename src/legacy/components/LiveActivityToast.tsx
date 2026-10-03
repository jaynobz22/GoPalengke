// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, ShoppingBasket, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type Activity = {
  id: string;
  kind: 'order' | 'rider';
  message: string;
  isSample: boolean;
};

type CatalogSample = {
  product: string;
  store: string;
  market: string;
};

const SAMPLE_PRODUCTS = ['talong', 'okra', 'kamatis', 'tilapia', 'pechay', 'mangga', 'baboy liempo'];
const SAMPLE_STORES = ['Aling Nena Fish Stall', 'Mang Tomas Meat Shop', 'Lola Maria Gulayan', 'Kuya Berting Manokan'];
const SAMPLE_MARKETS = ['Calinan Public Market', 'Bankerohan Public Market', 'Agdao Public Market', 'Toril Public Market'];
const SAMPLE_BARANGAYS = ['Calinan Proper', 'Buhangin', 'Matina', 'Mintal', 'Toril'];
const SAMPLE_WEIGHTS = ['¼ kg', '½ kg', '1 kg', '1½ kg', '2 kg'];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatQuantity(quantity: number, unit?: string | null) {
  const normalizedUnit = String(unit || 'kg').toLowerCase();
  if (normalizedUnit.includes('kg') || normalizedUnit.includes('kilo')) {
    if (quantity === 0.25) return '¼ kg';
    if (quantity === 0.5) return '½ kg';
    if (quantity === 1.5) return '1½ kg';
    return `${quantity} kg`;
  }
  return `${quantity} ${unit || 'item'}`;
}

function buildSample(catalog: CatalogSample[]): Activity {
  const riderActivity = Math.random() < 0.34;
  if (riderActivity) {
    return {
      id: `sample-rider-${Date.now()}`,
      kind: 'rider',
      isSample: true,
      message: `A rider has just picked up a parcel for delivery to ${pick(SAMPLE_BARANGAYS)}.`,
    };
  }

  const item = catalog.length > 0 ? pick(catalog) : {
    product: pick(SAMPLE_PRODUCTS),
    store: pick(SAMPLE_STORES),
    market: pick(SAMPLE_MARKETS),
  };
  return {
    id: `sample-order-${Date.now()}`,
    kind: 'order',
    isSample: true,
    message: `Someone has just bought ${pick(SAMPLE_WEIGHTS)} of ${item.product} from ${item.store} at ${item.market}.`,
  };
}

export function LiveActivityToast() {
  const { profile } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [catalog, setCatalog] = useState<CatalogSample[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const nextTimer = useRef<number | null>(null);
  const seen = useRef(new Set<string>());

  const showActivity = useCallback((next: Activity) => {
    if (document.visibilityState !== 'visible') return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setActivity(next);
    hideTimer.current = window.setTimeout(() => setActivity(null), 6500);
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') return;
    let active = true;

    supabase
      .from('products')
      .select('name, store:stores(name, palengke_name, barangay, is_verified, is_open)')
      .eq('is_available', true)
      .limit(30)
      .then(({ data }) => {
        if (!active) return;
        const rows = (data || [])
          .filter((row: any) => row.store?.is_verified && row.store?.is_open)
          .map((row: any) => ({
            product: row.name,
            store: row.store.name,
            market: row.store.palengke_name || row.store.barangay || 'lokal na palengke',
          }));
        setCatalog(rows);
      });

    return () => { active = false; };
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role === 'admin' || dismissed) return;

    const scheduleSample = () => {
      const delay = 18000 + Math.floor(Math.random() * 12000);
      nextTimer.current = window.setTimeout(() => {
        showActivity(buildSample(catalog));
        scheduleSample();
      }, delay);
    };

    const firstTimer = window.setTimeout(() => {
      showActivity(buildSample(catalog));
      scheduleSample();
    }, 6500);

    const showRealOrder = async (order: any) => {
      if (!order?.id || seen.current.has(`order-${order.id}`)) return;
      seen.current.add(`order-${order.id}`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const [{ data: items }, { data: store }] = await Promise.all([
        supabase.from('order_items').select('product_name, quantity, unit').eq('order_id', order.id).limit(1),
        supabase.from('stores').select('name, palengke_name, barangay').eq('id', order.store_id).maybeSingle(),
      ]);
      const item = items?.[0];
      if (!item || !store) return;
      showActivity({
        id: `order-${order.id}`,
        kind: 'order',
        isSample: false,
        message: `May bagong bumili ng ${formatQuantity(Number(item.quantity), item.unit)} na ${item.product_name} sa ${store.name}, ${store.palengke_name || store.barangay || 'lokal na palengke'}.`,
      });
    };

    const channel = supabase
      .channel(`public-live-activity-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        showRealOrder(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
        const order = payload.new;
        if (order?.status !== 'picked_up' || seen.current.has(`pickup-${order.id}`)) return;
        seen.current.add(`pickup-${order.id}`);
        showActivity({
          id: `pickup-${order.id}`,
          kind: 'rider',
          isSample: false,
          message: `May rider na kakakuha lang ng parcel para ihatid sa ${order.delivery_barangay || 'barangay ng buyer'}.`,
        });
      })
      .subscribe();

    return () => {
      window.clearTimeout(firstTimer);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
      supabase.removeChannel(channel);
    };
  }, [catalog, dismissed, profile?.role, showActivity]);

  if (profile?.role === 'admin' || dismissed || !activity) return null;

  const Icon = activity.kind === 'rider' ? Bike : ShoppingBasket;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-3 z-40 w-[calc(100vw-1.5rem)] max-w-sm animate-slide-up md:bottom-5 md:left-5"
    >
      <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-white/95 p-3 pr-9 shadow-lg backdrop-blur-sm">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Icon size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-5 text-gray-700">{activity.message}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase text-brand-700">
            {activity.isSample ? 'Sample activity' : 'Live activity'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Itago ang activity notifications"
          title="Itago"
          onClick={() => setDismissed(true)}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}