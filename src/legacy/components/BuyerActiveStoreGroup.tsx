import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreOrderTabs } from './StoreOrderTabs';
import { RiderStageBanner } from './RiderStageBanner';
import { canShowBuyerRiderTracking } from '../lib/buyerRiderTracking';
import { selectedStoreOrder } from '../lib/storeOrderGroups';
import { ORDER_STATUS_LABELS, type Order, type Store } from '../lib/types';

export function BuyerActiveStoreGroup({ orders, onOrderClick }: { orders: (Order & { store: Store })[]; onOrderClick: (order: Order) => void }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id);
  const order = selectedStoreOrder(orders, selectedId);
  if (!order) return null;
  return (
    <section className="border-b border-border pb-4">
      <p className="mb-2 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
      <StoreOrderTabs orders={orders} selectedId={order.id} onSelect={setSelectedId} />
      <div role="tabpanel" aria-label={order.store.name} className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">{order.store.name}</h3>
          <span className="shrink-0 text-xs font-medium text-primary">{ORDER_STATUS_LABELS[order.status]}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>₱{(Number(order.total) + Number(order.delivery_fee)).toFixed(2)}</span>
          <span>{order.payment_method === 'cod' ? 'COD' : order.payment_status === 'paid' ? 'Paid' : order.status === 'pending' ? 'Waiting for confirmation' : 'For payment'}</span>
        </div>
        {canShowBuyerRiderTracking(order) && <RiderStageBanner order={order} compact />}
        <Button variant="outline" onClick={() => onOrderClick(order)} className="w-full text-xs">
          {order.payment_method === 'qr_code' && order.status === 'accepted' && order.payment_status !== 'paid' ? 'View order / Pay' : 'View order'} <ChevronRight />
        </Button>
      </div>
    </section>
  );
}