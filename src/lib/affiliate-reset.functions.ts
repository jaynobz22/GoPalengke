import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Affiliate password reset. Affiliates use their own table (not app login),
// so codes are stateless HMACs of email + current password hash + 15-min window.
// Changing the password automatically invalidates any old code.

const WINDOW_MS = 15 * 60 * 1000;

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { GP_URL } = await import("./onboarding-reminders.server");
  const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Hindi naka-configure ang reset.");
  return createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function codeFor(email: string, pwHash: string, win: number) {
  const secret = process.env["GOPALENGKE_SERVICE_ROLE_KEY"] || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`aff-reset|${email}|${pwHash}|${win}`)));
  const n = new DataView(sig.buffer).getUint32(0);
  return String(n % 1000000).padStart(6, "0");
}

export const sendAffiliateResetCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const sb = await adminClient();
    const { data: aff } = await sb.from("affiliates").select("email, full_name, password_hash").eq("email", email).maybeSingle();
    if (!aff) return { ok: true }; // don't reveal if account exists
    const code = await codeFor(email, (aff as any).password_hash, Math.floor(Date.now() / WINDOW_MS));

    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const endpoint = LOVABLE_API_KEY ? "https://connector-gateway.lovable.dev/resend/emails" : "https://api.resend.com/emails";
    const auth = LOVABLE_API_KEY
      ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
      : { Authorization: `Bearer ${RESEND_API_KEY}` };
    const name = String((aff as any).full_name || "Affiliate").replace(/[<>&"']/g, "");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        from: "GoPalengke Admin <admin@gopalengke.net>",
        to: [email],
        subject: "GoPalengke Affiliate: Code para sa bagong password",
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#16a34a">GoPalengke Affiliate</h2><p>Hi ${name},</p><p>Ito ang code para makagawa ng bagong password:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#16a34a">${code}</p><p>Valid ito ng mga 15 minuto. Kung hindi ikaw ang humingi nito, huwag pansinin ang email na ito.</p></div>`,
      }),
    });
    if (!res.ok) throw new Error("Hindi maipadala ang code. Subukan ulit.");
    return { ok: true };
  });

export const resetAffiliatePassword = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/), password: z.string().min(6).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const sb = await adminClient();
    const { data: aff } = await sb.from("affiliates").select("id, password_hash").eq("email", email).maybeSingle();
    if (!aff) throw new Error("Mali o expired na ang code.");
    const win = Math.floor(Date.now() / WINDOW_MS);
    const pw = (aff as any).password_hash;
    const valid = data.code === (await codeFor(email, pw, win)) || data.code === (await codeFor(email, pw, win - 1));
    if (!valid) throw new Error("Mali o expired na ang code.");
    const { error } = await sb.from("affiliates").update({ password_hash: simpleHash(data.password) }).eq("id", (aff as any).id);
    if (error) throw new Error("Hindi ma-save ang bagong password.");
    return { ok: true };
  });
