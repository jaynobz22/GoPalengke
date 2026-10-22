// Buyer-arranged heavy cargo: when a cart is too heavy for a single motorcycle,
// the buyer may bring their own bao-bao/tricycle/minivan driver. The order then
// carries a marker in buyer_note so the seller skips rider assignment.

/** Above this weight a single motorcycle can no longer carry the order. */
export const MOTORCYCLE_MAX_KG = 25;

export const BUYER_ARRANGED_MARKER = '🚚 [MAY SARILING MAGKAKARGA]';

export function buildBuyerNote(note: string, arranged: boolean, driver?: string): string | null {
  const clean = (note || '').trim();
  if (!arranged) return clean || null;
  const d = (driver || '').trim();
  const head = `${BUYER_ARRANGED_MARKER} May kausap nang magkakarga ang buyer${d ? `: ${d}` : ''}. Huwag nang mag-assign ng rider.`;
  return clean ? `${head}\n${clean}` : head;
}

export function isBuyerArranged(note: string | null | undefined): boolean {
  return !!note && note.startsWith(BUYER_ARRANGED_MARKER);
}
