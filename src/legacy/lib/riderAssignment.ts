export function itemWeightKg(qtyRaw: unknown, unitRaw: unknown): number {
  const qty = Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const unit = String(unitRaw || '').toLowerCase();
  if (['kilo', 'kg', 'kilogram', 'liter', 'litro', 'l'].includes(unit)) return qty;
  if (['gram', 'g'].includes(unit)) return qty / 1000;
  if (['bundle', 'bugkos'].includes(unit)) return qty * 2;
  if (['tray', 'itlog'].includes(unit)) return qty;
  if (['piece', 'pc', 'piraso'].includes(unit)) return qty * 0.3;
  if (['dozen', 'dosen'].includes(unit)) return qty * 1.5;
  if (['sack', 'sako'].includes(unit)) return qty * 25;
  return qty * 0.5;
}

export function cargoWeight(orders: { status?: string; items?: { quantity: unknown; unit?: unknown }[] }[]): number {
  return orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + itemWeightKg(i.quantity, i.unit), 0), 0);
}

export function canCarryCargo(vehicle: string | null | undefined, kg: number): boolean {
  if (!Number.isFinite(kg) || kg < 0) return false;
  if (vehicle === 'minivan') return kg <= 500;
  if (vehicle === 'tricycle') return kg <= 150;
  return (vehicle === 'motorcycle' || !vehicle) && kg <= 25;
}

export function canDeclineAssignment(order: { rider_id?: string | null; rider_accepted_at?: string | null; status?: string }, riderId: string): boolean {
  return order.rider_id === riderId && !order.rider_accepted_at && ['pending', 'accepted', 'preparing', 'ready_for_pickup'].includes(order.status || '');
}