type StoreOrder = { id: string; store_id: string; buyer_id?: string; delivery_group_id?: string | null };

export function groupStoreOrders<T extends StoreOrder>(orders: T[]): { key: string; orders: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const order of orders) {
    const key = order.delivery_group_id ? `${order.buyer_id || ''}:${order.delivery_group_id}` : order.id;
    const group = groups.get(key);
    if (group) group.push(order);
    else groups.set(key, [order]);
  }
  return Array.from(groups, ([key, rows]) => ({ key, orders: rows }));
}

export function selectedStoreOrder<T extends StoreOrder>(orders: T[], selectedId?: string): T | undefined {
  return orders.find(order => order.id === selectedId) || orders[0];
}

export function canShowStorePayment(order: { status: string; payment_method: string; payment_status: string }): boolean {
  return order.payment_method === 'qr_code' && order.payment_status !== 'paid' &&
    ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered'].includes(order.status);
}