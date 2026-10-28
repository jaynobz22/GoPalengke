import { Store, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TabOrder = { id: string; store?: { name: string } | null; payment_status?: string; picked_up_at?: string | null };

export function StoreOrderTabs({ orders, selectedId, onSelect, mode = 'buyer' }: {
  orders: TabOrder[]; selectedId?: string; onSelect: (id: string) => void; mode?: 'buyer' | 'rider';
}) {
  if (orders.length < 2) return null;
  return (
    <div role="tablist" aria-label="Mga tindahan" className="grid grid-cols-2 gap-1.5 mb-3 sm:flex sm:flex-wrap">
      {orders.map((order, index) => {
        const selected = order.id === selectedId;
        const done = mode === 'rider' ? !!order.picked_up_at : order.payment_status === 'paid';
        return (
          <Button key={order.id} type="button" role="tab" aria-selected={selected}
            title={order.store?.name || `Store ${index + 1}`} onClick={() => onSelect(order.id)}
            variant={selected ? 'default' : 'outline'}
            className="h-auto min-h-10 min-w-0 justify-start gap-1.5 px-2 py-2 text-[11px] whitespace-normal sm:max-w-48 sm:flex-1">
            <Store className="shrink-0" />
            <span className="min-w-0 break-words text-left leading-tight">{order.store?.name || `Store ${index + 1}`}</span>
            {done && <Check className="ml-auto shrink-0" />}
          </Button>
        );
      })}
    </div>
  );
}