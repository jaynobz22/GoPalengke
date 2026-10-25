export const RIDER_PLATFORM_RATE = 0.03;
export const RIDER_PLATFORM_MILESTONE = 500;
export const RIDER_ONBOARDING_GROSS = 1000;
export const RIDER_ONBOARDING_AMOUNT = 300;

export function riderOnboardingCharge(gross: number, status: string) {
  return gross >= RIDER_ONBOARDING_GROSS && status === 'pending' ? RIDER_ONBOARDING_AMOUNT : 0;
}

export function riderAffiliateSplit(hasSponsor: boolean) {
  return { direct: hasSponsor ? 35 : 50, upline: hasSponsor ? 15 : 0 };
}

export function riderPaidMilestones(platformPaid: number) {
  return Math.floor(Math.max(0, platformPaid) / RIDER_PLATFORM_MILESTONE);
}

export function riderFeeProgress(balance: number) {
  const current = Math.max(0, balance);
  return { current, remaining: Math.max(0, 500 - current), percent: Math.min(100, current / 500 * 100) };
}