import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Password reset for Buyer/Seller/Rider/Admin with its own "reset password" email
// (the auth OTP template is worded for sign-up). Codes are stateless HMACs of
// user id + auth updated_at + 15-min window; a password change invalidates old codes.

const WINDOW_MS = 15 * 60 * 1000;

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { GP_URL } = await import("./onboarding-reminders.server");
  const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Hindi naka-configure ang reset.");
  return createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function codeFor(uid: string, stamp: string, win: number) {
  const secret = process.env["GOPALENGKE_SERVICE_ROLE_KEY"] || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`user-reset|${uid}|${stamp}|${win}`)));
  const n = new DataView(sig.buffer).getUint32(0);
  return String(n % 1000000).padStart(6, "0");
}

async function findUser(sb: any, email: string) {
  const { data: prof } = await sb.from("profiles").select("id, full_name").ilike("email", email).maybeSingle();
  if (!prof) return null;
  const { data } = await sb.auth.admin.getUserById(prof.id);
  if (!data?.user) return null;
  return { id: prof.id as string, name: prof.full_name as string | null, stamp: String(data.user.updated_at || "") };
}

export const sendUserResetCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const sb = await adminClient();
    const u = await findUser(sb, email);
    if (!u) return { ok: false, notFound: true };
    const code = await codeFor(u.id, u.stamp, Math.floor(Date.now() / WINDOW_MS));

    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const endpoint = LOVABLE_API_KEY ? "https://connector-gateway.lovable.dev/resend/emails" : "https://api.resend.com/emails";
    const auth = LOVABLE_API_KEY
      ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
      : { Authorization: `Bearer ${RESEND_API_KEY}` };
    const name = String(u.name || "ka-GoPalengke").replace(/[<>&"']/g, "");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        from: "GoPalengke <admin@gopalengke.net>",
        to: [email],
        subject: "GoPalengke: Code para sa bagong password",
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#16a34a">GoPalengke</h2><p>Hi ${name},</p><p>May humiling na palitan ang password ng iyong GoPalengke account. Gamitin ang code sa ibaba para makagawa ng bagong password:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#16a34a">${code}</p><p>Valid ito ng mga 15 minuto. Kung hindi ikaw ang humingi nito, huwag pansinin ang email na ito — hindi mapapalitan ang password mo.</p></div>`,
      }),
    });
    if (!res.ok) throw new Error("Hindi maipadala ang code. Subukan ulit.");
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/), password: z.string().min(6).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const sb = await adminClient();
    const u = await findUser(sb, email);
    if (!u) throw new Error("Mali o expired na ang code.");
    const win = Math.floor(Date.now() / WINDOW_MS);
    const valid = data.code === (await codeFor(u.id, u.stamp, win)) || data.code === (await codeFor(u.id, u.stamp, win - 1));
    if (!valid) throw new Error("Mali o expired na ang code.");
    const { error } = await sb.auth.admin.updateUserById(u.id, { password: data.password });
    if (error) throw new Error("Hindi ma-save ang bagong password.");
    return { ok: true };
  });
