// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Beef, Bike, Fish, Leaf, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type Kind = 'gulay' | 'karne' | 'isda' | 'rider';
type Activity = { id: string; kind: Kind; message: string; isSample: boolean };

const SHOW_MS = 10000;
const GAP_MS = 10000;
const FADE_MS = 700;

// Rotation: gulay → karne → rider → isda (never same kind twice in a row)
const SAMPLES: Omit<Activity, 'id' | 'isSample'>[] = [
  { kind: 'gulay', message: 'May bumili ng ½ kg na talong sa Lola Maria Gulayan, Calinan Public Market.' },
  { kind: 'karne', message: 'May bumili ng 1 kg na baboy liempo sa Mang Tomas Meat Shop, Bankerohan.' },
  { kind: 'rider', message: 'May rider na kakakuha lang ng parcel para ihatid sa Brgy. Mintal.' },
  { kind: 'isda', message: 'May bumili ng 1 kg na bangus sa Aling Nena Fish Stall, Agdao Public Market.' },
  { kind: 'gulay', message: 'May bumili ng ¼ kg na okra sa Toril Public Market.' },
  { kind: 'karne', message: 'May bumili ng 1½ kg na manok sa Kuya Berting Manokan, Calinan.' },
  { kind: 'rider', message: 'May rider na papunta na sa buyer sa Brgy. Buhangin.' },
  { kind: 'isda', message: 'May bumili ng ½ kg na tilapia sa Tita Linda Fresh Catch, Bankerohan.' },
  { kind: 'gulay', message: 'May bumili ng 1 kg na kamatis at pechay sa Agdao Public Market.' },
  { kind: 'karne', message: 'May bumili ng 2 kg na baka sa Bankerohan Public Market.' },
  { kind: 'rider', message: 'May rider na kakapick-up lang ng order para sa Matina.' },
  { kind: 'isda', message: 'May bumili ng 1 kg na hipon sa Toril Public Market.' },
];

const STYLE: Record<Kind, { box: string; icon: string; label: string; Icon: any }> = {
  gulay: { box: 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100', icon: 'bg-emerald-500 text-white', label: 'text-emerald-700', Icon: Leaf },
  karne: { box: 'border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100', icon: 'bg-rose-500 text-white', label: 'text-rose-700', Icon: Beef },
  isda: { box: 'border-sky-300 bg-gradient-to-br from-sky-50 to-sky-100', icon: 'bg-sky-500 text-white', label: 'text-sky-700', Icon: Fish },
  rider: { box: 'border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100', icon: 'bg-amber-500 text-white', label: 'text-amber-700', Icon: Bike },
};

function formatQuantity(quantity: number, unit?: string | null) {
  const u = String(unit || 'kg').toLowerCase();
  if (u.includes('kg') || u.includes('kilo')) {
    if (quantity === 0.25) return '¼ kg';
    if (quantity === 0.5) return '½ kg';
    if (quantity === 1.5) return '1½ kg';
    return `${quantity} kg`;
  }
  return `${quantity} ${unit || 'item'}`;
}

function guessKind(text: string): Kind {
  const t = text.toLowerCase();
  if (/isda|fish|tilapia|bangus|hipon|pusit|galunggong|tuna|seafood|catch/.test(t)) return 'isda';
  if (/baboy|baka|manok|karne|meat|liempo|chicken|pork|beef|manokan/.test(t)) return 'karne';
  return 'gulay';
}

export function LiveActivityToast() {
  const { session, profile, loading } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isHome, setIsHome] = useState(false);
  const queue = useRef<Activity[]>([]);
  const seen = useRef(new Set<string>());

  const loggedIn = !!session || !!profile;
  const enabled = !loading && !loggedIn && isHome && !dismissed;

  useEffect(() => {
    const check = () => setIsHome(window.location.pathname === '/');
    check();
    const id = window.setInterval(check, 1000);
    window.addEventListener('popstate', check);
    return () => { window.clearInterval(id); window.removeEventListener('popstate', check); };
  }, []);

  // Cycle: show 10s → fade out → wait 10s → next (real events first)
  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    let idx = Math.floor(Math.random() * 4) * 1; // start somewhere in the cycle
    let timers: number[] = [];
    let alive = true;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => alive && fn(), ms));

    const showNext = () => {
      if (document.visibilityState !== 'visible') { later(showNext, GAP_MS); return; }
      const real = queue.current.shift();
      const next = real || { ...SAMPLES[idx++ % SAMPLES.length], id: `s-${Date.now()}`, isSample: true };
      setActivity(next);
      later(() => setVisible(true), 50);
      later(() => setVisible(false), 50 + SHOW_MS);
      later(showNext, 50 + SHOW_MS + FADE_MS + GAP_MS);
    };
    later(showNext, 4000);
    return () => { alive = false; timers.forEach((t) => window.clearTimeout(t)); };
  }, [enabled]);

  // Real activity feed
  useEffect(() => {
    if (!enabled) return;
    const pushReal = (a: Activity) => { if (!seen.current.has(a.id)) { seen.current.add(a.id); queue.current.push(a); } };

    const channel = supabase
      .channel(`public-live-activity-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload: any) => {
        const order = payload.new;
        if (!order?.id) return;
        await new Promise((r) => window.setTimeout(r, 1200));
        const [{ data: items }, { data: store }] = await Promise.all([
          supabase.from('order_items').select('product_name, quantity, unit').eq('order_id', order.id).limit(1),
          supabase.from('stores').select('name, palengke_name, barangay').eq('id', order.store_id).maybeSingle(),
        ]);
        const item = items?.[0];
        if (!item || !store) return;
        pushReal({
          id: `order-${order.id}`,
          kind: guessKind(`${item.product_name} ${store.name}`),
          isSample: false,
          message: `May bumili ng ${formatQuantity(Number(item.quantity), item.unit)} na ${item.product_name} sa ${store.name}, ${store.palengke_name || store.barangay || 'lokal na palengke'}.`,
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
        const order = payload.new;
        if (order?.status !== 'picked_up') return;
        pushReal({
          id: `pickup-${order.id}`,
          kind: 'rider',
          isSample: false,
          message: `May rider na kakakuha lang ng parcel para ihatid sa ${order.delivery_barangay || 'barangay ng buyer'}.`,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  if (!enabled || !activity) return null;
  const s = STYLE[activity.kind];
  const Icon = s.Icon;

  return (
    <aside
      aria-live="polite"
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-3 z-40 w-[calc(100vw-1.5rem)] max-w-[280px] transition-all duration-700 ease-in-out md:bottom-5 md:left-5 ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <div className={`relative flex items-center gap-2 rounded-xl border p-2.5 pr-7 shadow-md ${s.box}`}>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.icon}`}>
          <Icon size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] leading-4 text-gray-800">{activity.message}</p>
          <p className={`mt-0.5 text-[9px] font-semibold uppercase tracking-wide ${s.label}`}>
            {activity.isSample ? 'Sample activity' : '● Live activity'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Itago ang activity notifications"
          onClick={() => setDismissed(true)}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white/70 hover:text-gray-700"
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
