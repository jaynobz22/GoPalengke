export function paymentAffiliateShares(transactions: { description?: string | null; amount?: number | string | null; status?: string }[]) {
  const shares: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.status !== 'credited') continue;
    const match = /\[(fp|rfp):([0-9a-f-]+)\]/.exec(tx.description || '');
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    shares[key] = (shares[key] || 0) + Number(tx.amount || 0);
  }
  return shares;
}