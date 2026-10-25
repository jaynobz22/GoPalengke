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

export function riderPaidMilestones(platformPaid: number, onboardingPaid = 0) {
  const paid = Math.max(0, platformPaid) + Math.min(RIDER_ONBOARDING_AMOUNT, Math.max(0, onboardingPaid));
  return Math.floor(Math.round(paid * 100) / (RIDER_PLATFORM_MILESTONE * 100));
}

export function riderFeeProgress(balance: number, onboardingStatus = 'paid', onboardingPaid = 0) {
  const onboardingDue = onboardingStatus === 'active'
    ? Math.max(0, RIDER_ONBOARDING_AMOUNT - Math.min(RIDER_ONBOARDING_AMOUNT, Math.max(0, onboardingPaid))) : 0;
  const current = Math.round((Math.max(0, balance) + onboardingDue) * 100) / 100;
  return { current, remaining: Math.round(Math.max(0, 500 - current) * 100) / 100, percent: Math.min(100, current / 500 * 100) };
}