import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GP_URL = "https://melwjygaczevpasgazfo.supabase.co";
const GP_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHdqeWdhY3pldnBhc2dhemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTQ1MjcsImV4cCI6MjEwNDA3MDUyN30.tsqdbMBiCc5uJvd3eyk54S51TN1ZxoYusQOwwKWooq0";
export const BETA_INVITE_DELAY_MIN = 20;
const OPT_IN_URL = "https://play.google.com/apps/testing/net.gopalengke";
const STORE_URL = "https://play.google.com/store/apps/details?id=net.gopalengke";

function esc(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

function inviteHtml(name: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111827">
<h2 style="color:#16a34a;margin:0 0 12px">GoPalengke Beta Testing</h2>
<p>Hi ${esc(name)},</p>
<p>Salamat sa pagsali bilang beta tester! Naka-lista ka na sa GoPalengke closed testing sa Google Play. Gamitin ang parehong Gmail account na ito sa Play Store ng Android phone mo.</p>
<p style="margin:24px 0"><a href="${OPT_IN_URL}" style="background:#16a34a;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">1. Maging Tester (Opt in)</a></p>
<p style="margin:24px 0"><a href="${STORE_URL}" style="background:#15803d;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">2. I-download ang App sa Play Store</a></p>
<p>Pakigamit ang app kahit isang beses kada araw sa loob ng 14 na araw at huwag i-uninstall. Kung "App not available" ang lumabas, maghintay ng ilang minuto at subukan ulit.</p>
<p style="font-size:13px;color:#6b7280">May tanong? I-reply lang ang email na ito.</p>
</div>`;
}

export const scheduleBetaInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10), testerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(GP_URL, GP_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: userRes, error: userErr } = await sb.auth.getUser(data.accessToken);
    if (userErr || !userRes.user) throw new Error("Hindi naka-login.");
    const { data: me } = await sb.from("profiles").select("role").eq("id", userRes.user.id).maybeSingle();
    if ((me as any)?.role !== "admin") throw new Error("Admin lang ang pwede.");

    const { data: tester, error } = await sb.from("beta_testers").select("*").eq("id", data.testerId).maybeSingle();
    if (error || !tester) throw new Error("Hindi mahanap ang tester.");
    if ((tester as any).status === "email_scheduled") return { ok: true, already: true };

    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
    const useGateway = Boolean(LOVABLE_API_KEY);
    const endpoint = useGateway ? "https://connector-gateway.lovable.dev/resend/emails" : "https://api.resend.com/emails";
    const headers: Record<string, string> = useGateway
      ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
      : { Authorization: `Bearer ${RESEND_API_KEY}` };

    const sendAt = new Date(Date.now() + BETA_INVITE_DELAY_MIN * 60 * 1000).toISOString();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        from: "GoPalengke <admin@gopalengke.net>",
        to: [(tester as any).email],
        subject: "Ang download link mo ng GoPalengke app (Beta Tester)",
        html: inviteHtml((tester as any).full_name),
        scheduled_at: sendAt,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Beta invite failed [${res.status}]: ${body}`);
      throw new Error(`Hindi naiskedyul ang email [${res.status}]: ${body.slice(0, 200)}`);
    }
    const { error: upErr } = await sb
      .from("beta_testers")
      .update({ status: "email_scheduled", added_to_play_at: new Date().toISOString() })
      .eq("id", data.testerId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, sendAt };
  });
