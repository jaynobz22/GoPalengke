export const SELLER_FEE_RATE = 0.03;
export const SELLER_MILESTONE = 1000;
export const SELLER_TIER1 = 150;
export const SELLER_TIER2 = 50;
export const SELLER_COMMISSION_TOTAL = SELLER_TIER1 + SELLER_TIER2;

/** Paid/credited milestones retire fee cycles; reaching a threshold alone does not. */
export function sellerMilestoneProgress(deliveredSales: number, paidMilestones = 0) {
  const safeSales = Number.isFinite(deliveredSales) ? Math.max(0, deliveredSales) : 0;
  const cycles = Number.isFinite(paidMilestones) ? Math.max(0, Math.floor(paidMilestones)) : 0;
  const accruedFees = Math.round(safeSales * SELLER_FEE_RATE * 100) / 100;
  const outstandingFees = Math.max(0, Math.round((accruedFees - cycles * SELLER_MILESTONE) * 100) / 100);
  const currentFees = Math.min(SELLER_MILESTONE, outstandingFees);
  return {
    accruedFees,
    outstandingFees,
    currentFees,
    remaining: Math.round((SELLER_MILESTONE - currentFees) * 100) / 100,
    percent: currentFees / SELLER_MILESTONE * 100,
    awaitingPayment: outstandingFees >= SELLER_MILESTONE,
  };
}