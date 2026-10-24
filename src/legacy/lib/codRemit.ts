// COD: kinokolekta ng rider sa buyer ang paninda + delivery fee.
// Ang rider's fee (delivery fee + seller-funded free-delivery subsidy) ay sa rider na,
// kaya ang ipapadala lang sa seller ay ang natira.
export type CodOrderLike = { total: number | string; delivery_fee?: number | string | null; seller_delivery_subsidy?: number | string | null };

export function riderFeeFor(o: CodOrderLike): number {
  return round(Number(o.delivery_fee || 0) + Number(o.seller_delivery_subsidy || 0));
}

export function buyerPaysCod(o: CodOrderLike): number {
  return round(Number(o.total || 0) + Number(o.delivery_fee || 0));
}

export function codRemitToSeller(o: CodOrderLike): number {
  return Math.max(0, round(buyerPaysCod(o) - riderFeeFor(o)));
}

function round(n: number) { return Math.round(n * 100) / 100; }
