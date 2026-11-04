// Iisang branded email layout ng GoPalengke (logo header, card, links, footer).
// Browser-safe: walang server imports. Gamitin ng LAHAT ng user emails
// (welcome, reminders, admin broadcast, reset codes, beta invite, future promos).

export const EMAIL_SITE = "https://www.gopalengke.net";
export const EMAIL_LOGO = "https://www.gopalengke.net/images/Copilot_20260907_183703.jpg";

export function escapeEmailHtml(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export type EmailLayoutOptions = {
  /** Trusted inner HTML (escape user text before passing). */
  bodyHtml: string;
  title?: string;
  preheader?: string;
  footerNote?: string;
};

export function emailCta(label: string, href: string, color = "#16a34a") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto"><tr>
<td align="center" bgcolor="${color}" style="border-radius:12px">
<a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${escapeEmailHtml(label)}</a>
</td></tr></table>`;
}

export function emailCode(code: string) {
  return `<div style="text-align:center;margin:18px 0"><span style="display:inline-block;font-size:32px;font-weight:bold;letter-spacing:6px;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 20px">${escapeEmailHtml(code)}</span></div>`;
}

export function emailLayout({ bodyHtml, title = "GoPalengke", preheader = "", footerNote = "" }: EmailLayoutOptions) {
  const link = (href: string, label: string) =>
    `<a href="${EMAIL_SITE}${href}" style="color:#15803d;text-decoration:none;font-weight:bold">${label}</a>`;
  const dot = `<span style="color:#d1d5db">&nbsp;&bull;&nbsp;</span>`;
  return `<!doctype html>
<html lang="tl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeEmailHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#15803d;padding:26px 24px" align="center">
    <img src="${EMAIL_LOGO}" width="64" height="64" alt="GoPalengke" style="display:block;border-radius:16px;border:3px solid rgba(255,255,255,.35);margin:0 auto 10px">
    <div style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:.3px">GoPalengke</div>
    <div style="font-size:13px;color:#dcfce7;margin-top:2px">The First Online Wet Market sa Pilipinas</div>
  </td></tr>
  <tr><td style="padding:28px 24px;font-size:15px;line-height:1.65;color:#374151">${bodyHtml}</td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 24px" align="center">
    <div style="font-size:13px;font-weight:bold;color:#374151;margin-bottom:10px">Mga Mahalagang Link</div>
    <div style="font-size:14px;line-height:2">
      ${link("/tutorial", "Video Tutorial")}${dot}${link("/affiliate", "Affiliate Program")}${dot}${link("/legal/terms", "Terms of Service")}${dot}${link("/legal/privacy", "Privacy Policy")}
    </div>
  </td></tr>
  <tr><td style="background:#ffffff;border-top:1px solid #e5e7eb;padding:16px 24px" align="center">
    <div style="font-size:12px;line-height:1.6;color:#9ca3af">
      ${footerNote ? `${footerNote}<br>` : ""}May tanong? I-reply lang ang email na ito.<br>
      &copy; GoPalengke &mdash; Online palengke ng bayan
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
