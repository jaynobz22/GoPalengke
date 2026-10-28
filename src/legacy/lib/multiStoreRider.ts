// Shared multi-store rider rules (browser-safe).

/** Extra rider fee per additional store pickup for the same buyer batch. */
export const EXTRA_PICKUP_FEE = 10;

/** Delivery fee for a non-primary store in a multi-store batch. */
export function extraStorePickupFee(isPrimary: boolean, combinedStores: number): number {
  return !isPrimary && combinedStores > 1 ? EXTRA_PICKUP_FEE : 0;
}

/** Rider already assigned by another store in the same buyer batch, if any. */
export function lockedGroupRider(siblings: { rider_id?: string | null; status?: string | null }[]): string | null {
  for (const s of siblings) {
    if (s.rider_id && s.status !== 'cancelled') return s.rider_id;
  }
  return null;
}
