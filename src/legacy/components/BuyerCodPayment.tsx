import { useState } from 'react';
import { QrCode, Banknote, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DEFAULT_BUYER_COD_PAYMENT } from '../lib/buyerCodPayment';

export function BuyerCodPayment({ amount, qrUrl, riderName }: { amount: number; qrUrl: string | null; riderName: string }) {
  const [method, setMethod] = useState<'qr' | 'cash'>(DEFAULT_BUYER_COD_PAYMENT);
  async function downloadQr() {
    if (!qrUrl) return;
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('Download failed');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url; a.download = 'rider-qr.png'; a.click(); URL.revokeObjectURL(url);
    } catch { window.open(qrUrl, '_blank', 'noopener,noreferrer'); }
  }
  return (
    <section className="border border-border bg-background rounded-lg p-4 mb-3">
      <h3 className="font-semibold text-foreground mb-1">Magbayad sa Rider</h3>
      <p className="text-sm text-muted-foreground mb-3">{riderName} · Paninda + delivery fee: <strong className="text-foreground">₱{amount.toFixed(2)}</strong></p>
      <RadioGroup aria-label="Paraan ng COD payment" value={method} onValueChange={v => { if (v === 'qr' || v === 'cash') setMethod(v); }} className="grid-cols-2 mb-4">
        <label className="flex items-center gap-2 border border-border rounded-lg p-3 cursor-pointer">
          <RadioGroupItem value="qr" aria-label="QR" /><QrCode size={18} /><span>QR</span>
        </label>
        <label className="flex items-center gap-2 border border-border rounded-lg p-3 cursor-pointer">
          <RadioGroupItem value="cash" aria-label="Cash" /><Banknote size={18} /><span>Cash</span>
        </label>
      </RadioGroup>
      {method === 'qr' ? qrUrl ? (
        <>
          <p className="text-sm text-muted-foreground mb-3">I-scan ang QR at bayaran ang rider ng ₱{amount.toFixed(2)}. Ipakita sa rider ang payment receipt.</p>
          <div className="flex justify-center mb-3"><img src={qrUrl} alt="QR Code ng Rider" className="w-40 h-40 object-contain rounded-lg" /></div>
          <Button onClick={downloadQr} variant="outline" className="w-full whitespace-normal h-auto py-3"><Download /> I-download ang QR Code</Button>
        </>
      ) : <p className="text-sm text-muted-foreground">Wala pang QR ang rider. Piliin ang Cash o kausapin ang rider para sa payment details.</p>
      : <p className="text-sm text-muted-foreground">Ibigay ang ₱{amount.toFixed(2)} na cash sa rider pag-abot ng parcel.</p>}
    </section>
  );
}