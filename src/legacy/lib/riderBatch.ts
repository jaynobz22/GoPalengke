// @ts-nocheck
// Batch rules for ONE rider carrying orders of DIFFERENT buyers at the same time:
// 1. Lahat ng tindahan (pickup) ay magkakalapit — hindi lalagpas ng 1 km sa isa't isa.
// 2. Lahat ng drop-off point ay magkakalapit — hindi lalagpas ng 1 km (walang opposite direction).
// 3. Kabuuang bigat ng karga ay hanggang 20 kg lang.
// 4. Kapag nakaalis na ang rider sa palengke (picked_up) ng ibang buyer, hindi na pwedeng dagdagan.
// Bawat buyer at bawat tindahan ay may sariling delivery fee para sa rider.
import { supabase } from './supabase';
import { haversineKm, getStoreCoords } from './deliveryFee';

export const BATCH_MAX_DISTANCE_KM = 1;
export const BATCH_MAX_WEIGHT_KG = 20;

const ORDER_SELECT = 'id, delivery_group_id, status, delivery_lat, delivery_lng, delivery_barangay, delivery_city, store:stores(id, name, latitude, longitude, palengke_name, barangay, city, region), items:order_items(quantity, unit)';

export function itemWeightKg(qtyRaw: any, unitRaw: any): number {
  const qty = Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const unit = String(unitRaw || '').toLowerCase();
  if (unit === 'kilo' || unit === 'kg' || unit === 'kilogram') return qty;
  if (unit === 'gram' || unit === 'g') return qty / 1000;
  if (unit === 'pack' || unit === 'sachet') return qty * 0.5;
  if (unit === 'bundle' || unit === 'bugkos') return qty * 2;
  if (unit === 'tray' || unit === 'itlog') return qty * 1;
  if (unit === 'piece' || unit === 'pc' || unit === 'piraso') return qty * 0.3;
  if (unit === 'dozen' || unit === 'dosen') return qty * 1.5;
  if (unit === 'sack' || unit === 'sako') return qty * 25;
  if (unit === 'liter' || unit === 'litro' || unit === 'l') return qty;
  return qty * 0.5;
}

function orderWeight(o: any): number {
  return (o.items || []).reduce((s: number, i: any) => s + itemWeightKg(i.quantity, i.unit), 0);
}

function dropNear(a: any, b: any): boolean {
  if (a.delivery_lat != null && a.delivery_lng != null && b.delivery_lat != null && b.delivery_lng != null) {
    return haversineKm({ lat: Number(a.delivery_lat), lng: Number(a.delivery_lng) }, { lat: Number(b.delivery_lat), lng: Number(b.delivery_lng) }) <= BATCH_MAX_DISTANCE_KM;
  }
  // Walang eksaktong pin — payagan lang kung parehong barangay at city
  const norm = (s: any) => String(s || '').toLowerCase().trim();
  return !!norm(a.delivery_barangay) && norm(a.delivery_barangay) === norm(b.delivery_barangay) && norm(a.delivery_city) === norm(b.delivery_city);
}

function storeNear(a: any, b: any): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  const ca = getStoreCoords(a);
  const cb = getStoreCoords(b);
  if (ca && cb) return haversineKm(ca, cb) <= BATCH_MAX_DISTANCE_KM;
  return !!a.palengke_name && a.palengke_name === b.palengke_name;
}

/** Returns { ok: true } or { ok: false, reason } for giving `newOrder` (and its group) to `riderId`. */
export async function checkRiderBatch(riderId: string, newOrder: { id: string; delivery_group_id?: string | null }): Promise<{ ok: boolean; reason?: string }> {
  const [activeRes, newRes] = await Promise.all([
    supabase.from('orders').select(ORDER_SELECT).eq('rider_id', riderId).in('status', ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up']),
    newOrder.delivery_group_id
      ? supabase.from('orders').select(ORDER_SELECT).eq('delivery_group_id', newOrder.delivery_group_id)
      : supabase.from('orders').select(ORDER_SELECT).eq('id', newOrder.id),
  ]);
  const newOrders = (newRes.data || []) as any[];
  const newIds = new Set(newOrders.map(o => o.id));
  const active = ((activeRes.data || []) as any[]).filter(o => !newIds.has(o.id));
  if (active.length === 0) return { ok: true };

  if (active.some(o => o.status === 'picked_up')) {
    return { ok: false, reason: 'Nakaalis na ang rider sa palengke dala ang ibang order. Hindi na pwedeng isabay.' };
  }

  const all = [...active, ...newOrders];
  const weight = all.reduce((s, o) => s + orderWeight(o), 0);
  if (weight > BATCH_MAX_WEIGHT_KG) {
    return { ok: false, reason: `Lagpas ${BATCH_MAX_WEIGHT_KG} kg ang kabuuang karga (${weight.toFixed(1)} kg). Hindi pwedeng isabay sa iisang rider.` };
  }
  for (const n of newOrders) {
    for (const a of active) {
      if (!storeNear(n.store, a.store)) {
        return { ok: false, reason: `Lagpas ${BATCH_MAX_DISTANCE_KM} km ang layo ng mga tindahan (${n.store?.name || 'tindahan'} at ${a.store?.name || 'tindahan'}). Hindi pwedeng isabay.` };
      }
      if (!dropNear(n, a)) {
        return { ok: false, reason: `Magkalayo ang mga drop-off point (lagpas ${BATCH_MAX_DISTANCE_KM} km o ibang barangay). Pwede lang isabay kung iisang lugar ang mga buyer.` };
      }
    }
  }
  return { ok: true };
}
