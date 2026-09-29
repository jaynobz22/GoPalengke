import { Bike, Check, Store as StoreIcon, Clock } from 'lucide-react';

type Stage = { title: string; note: string; tone: 'amber' | 'green' | 'blue' } | null;

/** Kinukuha ang kasalukuyang yugto ng rider para sa isang order (para sa buyer/seller/rider). */
export function getRiderStage(order: any): Stage {
  if (!order?.rider_id) return null;
  if (order.status === 'ready_for_pickup') {
    if (!order.rider_accepted_at) {
      return { title: 'Naghihintay na tanggapin ng rider', note: 'Na-assign na ang rider. Hinihintay pa ang kanyang pag-accept.', tone: 'amber' };
    }
    if (order.picked_up_at) {
      return { title: 'Na Pick Up na ng Rider', note: 'Punta pa sa isang tindahan para kunin ang iba pang order, bago dumiretso sa buyer.', tone: 'blue' };
    }
    if (order.rider_arrived_store_at) {
      return { title: 'Nasa Tindahan na ang Rider', note: 'Kinukuha na ang order sa seller. Susunod: aalis na papunta sa buyer.', tone: 'green' };
    }
    return { title: 'Rider Accepted the Delivery', note: 'Going to Seller to Pick Up', tone: 'green' };
  }
  if (order.status === 'picked_up') {
    return { title: 'Na Pick Up na ng Rider', note: 'Aalis na ang rider — papunta na sa buyer.', tone: 'blue' };
  }
  return null;
}

const TONES = {
  amber: 'bg-amber-50 border-amber-300 text-amber-800',
  green: 'bg-green-50 border-green-400 text-green-800',
  blue: 'bg-blue-50 border-blue-300 text-blue-800',
};

export function RiderStageBanner({ order, compact = false }: { order: any; compact?: boolean }) {
  const stage = getRiderStage(order);
  if (!stage) return null;
  const Icon = stage.tone === 'amber' ? Clock : stage.tone === 'green' ? Check : order.status === 'picked_up' ? Bike : StoreIcon;
  if (compact) {
    return (
      <div className={`mt-2 rounded-xl border px-3 py-2 text-left ${TONES[stage.tone]}`}>
        <p className="text-xs font-bold flex items-center gap-1"><Icon size={12} /> {stage.title}</p>
        <p className="text-[11px] opacity-80">{stage.note}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border-2 p-4 mb-3 flex items-start gap-3 ${TONES[stage.tone]}`}>
      <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <p className="font-bold text-sm">{stage.title}</p>
        <p className="text-xs mt-0.5">{stage.note}</p>
      </div>
    </div>
  );
}
