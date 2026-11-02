// Browser-safe rule: what a frozen seller sees at the top of their dashboard.
// A seller is frozen only when seller_fees.frozen_at is set by the backend.

export const SELLER_FREEZE_NOTICE_TITLE = 'Pansamantalang na-freeze ang iyong account';

export const SELLER_FREEZE_NOTICE_BODY =
  'Dahal hindi pa bayad ang iyong payables, magbayad muna para patuloy kang makapagtitinda sa GoPalengke.';

export const SELLER_FREEZE_NOTICE_CTA = 'Magbayad';

export type SellerFreezeFee = {
  frozen_at?: string | null;
  total_payable?: number | null;
};

export type SellerFreezeNotice = {
  title: string;
  body: string;
  cta: string;
  amount: number;
};

export function sellerFreezeNotice(fee: SellerFreezeFee | null | undefined): SellerFreezeNotice | null {
  if (!fee || !fee.frozen_at) return null;
  const amount = Number(fee.total_payable);
  return {
    title: SELLER_FREEZE_NOTICE_TITLE,
    body: SELLER_FREEZE_NOTICE_BODY,
    cta: SELLER_FREEZE_NOTICE_CTA,
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

export function formatSellerPeso(amount: number): string {
  return `₱${(Number(amount) || 0).toFixed(2)}`;
}
