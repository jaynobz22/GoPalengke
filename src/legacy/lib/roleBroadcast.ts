// Browser-safe helpers for admin role-targeted email broadcasts.
export const BROADCAST_GROUPS = ['affiliate', 'rider', 'seller', 'buyer'] as const;
export type BroadcastGroup = typeof BROADCAST_GROUPS[number];

export const BROADCAST_GROUP_LABEL: Record<BroadcastGroup, string> = {
  affiliate: 'Affiliates', rider: 'Riders', seller: 'Sellers', buyer: 'Buyers',
};

type Row = { email?: string | null; role?: string | null; full_name?: string | null };

/** Keeps only real, deliverable, de-duplicated emails of the chosen group. */
export function broadcastRecipients(rows: Row[], group: BroadcastGroup): { email: string; name: string }[] {
  const seen = new Set<string>();
  const out: { email: string; name: string }[] = [];
  for (const r of rows) {
    if (group !== 'affiliate' && r.role !== group) continue;
    const email = (r.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (email.endsWith('@phone.gopalengke.net')) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: (r.full_name || '').trim() });
  }
  return out;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function broadcastHtml(name: string, body: string) {
  const paras = escapeHtml(body).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff">
<div style="background:#16a34a;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold">GoPalengke</div>
<div style="padding:24px;color:#1f2937;font-size:15px"><p style="margin:0 0 14px">Hi ${escapeHtml(name || 'ka-GoPalengke')},</p>${paras}
<p style="font-size:13px;color:#6b7280;margin:24px 0 0">— GoPalengke Admin</p></div></div>`;
}
