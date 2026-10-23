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

// In-app bao-bao/minivan rider chosen by the buyer at checkout. Stored as a
// marker line in buyer_note so the seller can assign that rider in one tap.
export const BUYER_PICKED_RIDER_PREFIX = '🛺 [PINILI NG BUYER:';

export function withPickedRider(note: string | null, riderId: string | null | undefined, riderName?: string): string | null {
  if (!riderId) return note;
  const line = `${BUYER_PICKED_RIDER_PREFIX}${riderId}] Pinili ng buyer si ${(riderName || 'rider').trim()} bilang magdedeliver.`;
  return note ? `${line}\n${note}` : line;
}

export function getPickedRiderId(note: string | null | undefined): string | null {
  if (!note) return null;
  const i = note.indexOf(BUYER_PICKED_RIDER_PREFIX);
  if (i < 0) return null;
  const rest = note.slice(i + BUYER_PICKED_RIDER_PREFIX.length);
  const end = rest.indexOf(']');
  const id = end > 0 ? rest.slice(0, end).trim() : '';
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
