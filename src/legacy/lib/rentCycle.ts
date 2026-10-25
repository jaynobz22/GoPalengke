export const RENT_CYCLE_DAYS = 30;
const DAY = 86_400_000;

/** Next ₱700 rent is due 30 days after the latest approved rent payment (or last charge if never paid). */
export function nextRentDue(
  lastRentPaidAt: string | null | undefined,
  lastChargeAt: string | null | undefined,
  now: Date = new Date(),
) {
  const base = lastRentPaidAt || lastChargeAt;
  if (!base) return null;
  const due = new Date(new Date(base).getTime() + RENT_CYCLE_DAYS * DAY);
  const daysLeft = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY));
  return { due, daysLeft, isDue: now.getTime() >= due.getTime() };
}
