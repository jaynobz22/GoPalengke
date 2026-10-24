/** A grouped pickup records this store only; departure activates the whole delivery group. */
export function pickupUpdate(deliveryGroupId: string | null | undefined, pickedUpAt: string, groupOrderCount?: number) {
  return deliveryGroupId && groupOrderCount !== 1
    ? { picked_up_at: pickedUpAt }
    : { status: 'picked_up' as const, picked_up_at: pickedUpAt };
}