// Tabbed per-store view for multi-store (grouped) orders: Tindahan 1..4.
// Each tab shows only that store's items and, for riders on COD orders,
// that store's own QR code and reference-number submission.
import { useEffect, useState } from 'react';
import { codRemitToSeller } from '../lib/codRemit';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem, Store } from '../lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../lib/types';

type GroupOrder = Order & { store: Store };

export function MultiStoreTabs({ orders, mode, showCod, onCodSubmitted }: { orders: GroupOrder[]; mode: 'rider' | 'buyer'; showCod?: boolean; onCodSubmitted?: (orderId: string, reference: string) => void }) {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const ids = orders.map(o => o.id).join(',');

  useEffect(() => {
    if (!orders.length) return;
    supabase.from('order_items').select('*').in('order_id', orders.map(o => o.id)).then(({ data }) => {
      const m: Record<string, OrderItem[]> = {};
      (data || []).forEach((it: any) => { (m[it.order_id] ||= []).push(it); });
      setItems(m);
    });
  }, [ids]);

  if (orders.length < 2) return null;
  const o = orders[Math.min(tab, orders.length - 1)];
  if (!o) return null;
  const amount = Number(o.total) + Number(o.delivery_fee);
  const ref = submitted[o.id] || o.cod_payment_reference;

  async function submit() {
    if (!o) return;
    const v = (refs[o.id] || '').trim();
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from('orders').update({ cod_payment_reference: v }).eq('id', o.id);
    setSaving(false);
    if (error) { alert('Hindi ma-submit ang reference. Subukan ulit.'); return; }
    setSubmitted(p => ({ ...p, [o.id]: v }));
    onCodSubmitted?.(o.id, v);
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-200 p-3 mb-3">
      <p className="text-xs font-bold text-brand-700 mb-2">🏪 {orders.length} na tindahan sa order na ito</p>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {orders.map((x, i) => {
          const done = !!(submitted[x.id] || x.cod_payment_reference);
          return (
            <button key={x.id} onClick={() => setTab(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${i === tab ? 'bg-brand-600 text-white border-brand-600' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
              Store {i + 1}{showCod && done ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{o.store.name}</p>
            <p className="text-xs text-gray-400">{[o.store.palengke_name, o.store.barangay, o.store.city].filter(Boolean).join(', ')}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</span>
        </div>
        <div className="space-y-1 mb-2">
          {(items[o.id] || []).map(it => (
            <div key={it.id} className="flex justify-between text-xs text-gray-600">
              <span>{it.product_name} × {it.quantity} {it.unit}</span>
              <span>₱{(Number(it.price) * Number(it.quantity)).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-gray-50 pt-1.5">
          <span>Kabuuan (Store {tab + 1})</span><span>₱{amount.toFixed(2)}</span>
        </div>

        {mode === 'buyer' && o.payment_method === 'qr_code' && o.payment_status !== 'paid' && o.store.qr_code_url && (
          <a href={o.store.qr_code_url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-semibold text-brand-700 underline">Buksan ang QR ng tindahang ito</a>
        )}

        {mode === 'rider' && showCod && o.payment_method === 'cod' && !o.cod_payment_accepted_at && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2">COD — ipadala ang ₱{codRemitToSeller(o).toFixed(2)} sa {o.store.name} (bawas na ang rider's fee)</p>
            {ref ? (
              <p className="text-xs text-amber-700">Nai-submit na ang reference ({ref}). Hinihintay ang confirmation ng seller.</p>
            ) : o.store.qr_code_url ? (
              <>
                <div className="bg-white rounded-lg p-3 flex justify-center mb-2">
                  <img src={o.store.qr_code_url} alt={`QR ng ${o.store.name}`} className="w-44 h-44 object-contain" />
                </div>
                <input value={refs[o.id] || ''} onChange={e => setRefs(p => ({ ...p, [o.id]: e.target.value }))}
                  placeholder="Reference number" className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm mb-2" />
                <button onClick={submit} disabled={saving || !(refs[o.id] || '').trim()}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Nagse-send...' : `I-submit para sa Store ${tab + 1}`}
                </button>
              </>
            ) : (
              <p className="text-xs text-amber-700">Walang QR code ang tindahang ito. Makipag-ugnayan sa seller.</p>
            )}
          </div>
        )}
        {mode === 'rider' && showCod && o.cod_payment_accepted_at && (
          <p className="mt-2 text-xs text-green-700 font-semibold">✓ Natanggap na ng seller ang bayad.</p>
        )}
      </div>
    </div>
  );
}
