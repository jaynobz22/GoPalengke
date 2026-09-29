import { createClient } from "@supabase/supabase-js";

// GoPalengke's own database (external project). Anon key is public.
export const GP_URL = "https://melwjygaczevpasgazfo.supabase.co";
export const GP_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbHdqeWdhY3pldnBhc2dhemZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTQ1MjcsImV4cCI6MjEwNDA3MDUyN30.tsqdbMBiCc5uJvd3eyk54S51TN1ZxoYusQOwwKWooq0";
const SITE = "https://www.gopalengke.net";
const FROM = "GoPalengke <admin@gopalengke.net>";
const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 40;

type Role = "seller" | "rider" | "buyer";
type Candidate = { id: string; email: string; name: string; role: Role; stage: "24h" | "7d"; missing: string[] };

const COPY: Record<Role, { subject: string; title: string; cta: string }> = {
  seller: {
    subject: "Konti na lang — i-setup na ang tindahan mo sa GoPalengke",
    title: "Handa na ang pwesto mo, suki!",
    cta: "I-setup ang Tindahan Ko",
  },
  rider: {
    subject: "Kumpletuhin ang Rider Profile mo para makabiyahe",
    title: "Konti na lang at makakabiyahe ka na!",
    cta: "Kumpletuhin ang Rider Profile",
  },
  buyer: {
    subject: "Kumpletuhin ang profile mo para mas mabilis ang delivery",
    title: "Para siguradong makarating ang order mo",
    cta: "Kumpletuhin ang Profile Ko",
  },
};

function esc(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

function emailHtml(c: Candidate) {
  const copy = COPY[c.role];
  const first = esc((c.name || "Suki").split(" ")[0] ?? "Suki");
  const items = c.missing.map((m) => `<li style="margin:4px 0">${esc(m)}</li>`).join("");
  const lead =
    c.stage === "7d"
      ? "Huling paalala na ito — hindi pa rin kumpleto ang account mo sa GoPalengke."
      : "Salamat sa pag-sign up sa GoPalengke! May ilang bagay pa na kulang sa account mo:";
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#15803d;border-radius:16px 16px 0 0;padding:20px 24px;color:#ffffff">
<div style="font-size:22px;font-weight:bold">GoPalengke</div>
<div style="font-size:13px;opacity:.9">Online palengke ng bayan</div></div>
<div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${copy.title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Hi ${first},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">${lead}</p>
<ul style="font-size:15px;line-height:1.5;padding-left:20px;margin:8px 0 20px">${items}</ul>
<a href="${SITE}/" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${copy.cta}</a>
<p style="font-size:13px;color:#6b7280;margin:24px 0 0">May tanong? I-reply lang ang email na ito o i-message kami sa GoPalengke app.</p>
</div></div></body></html>`;
}

async function findCandidates(sb: ReturnType<typeof createClient>): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - DAY).toISOString();
  const { data: profiles, error } = await sb
    .from("profiles")
    .select(
      "id,email,full_name,role,created_at,avatar_url,house_photo_url,rider_plate_number,rider_valid_id_url,onboarding_reminder_24h_at,onboarding_reminder_7d_at",
    )
    .in("role", ["seller", "rider", "buyer"])
    .lt("created_at", cutoff)
    .is("onboarding_reminder_7d_at", null)
    .limit(2000);
  if (error) throw new Error(error.message);

  const sellerIds = (profiles ?? []).filter((p: any) => p.role === "seller").map((p: any) => p.id);
  const storeBySeller = new Map<string, string>();
  const storesWithProducts = new Set<string>();
  if (sellerIds.length) {
    const { data: stores } = await sb.from("stores").select("id,seller_id").in("seller_id", sellerIds);
    for (const s of (stores ?? []) as any[]) storeBySeller.set(s.seller_id, s.id);
    const storeIds = [...storeBySeller.values()];
    if (storeIds.length) {
      const { data: prods } = await sb.from("products").select("store_id").in("store_id", storeIds);
      for (const p of (prods ?? []) as any[]) storesWithProducts.add(p.store_id);
    }
  }

  const now = Date.now();
  const out: Candidate[] = [];
  for (const p of (profiles ?? []) as any[]) {
    if (!p.email) continue;
    const missing: string[] = [];
    if (p.role === "seller") {
      const store = storeBySeller.get(p.id);
      if (!store) missing.push("Gumawa ng iyong tindahan");
      else if (!storesWithProducts.has(store)) missing.push("Mag-upload ng unang paninda");
    } else if (p.role === "rider") {
      if (!p.avatar_url) missing.push("Profile picture");
      if (!p.rider_plate_number) missing.push("Plate number ng sasakyan");
      if (!p.rider_valid_id_url) missing.push("Valid ID");
    } else {
      if (!p.avatar_url) missing.push("Profile picture");
      if (!p.house_photo_url) missing.push("Picture ng bahay (para madaling mahanap ng rider)");
    }
    if (!missing.length) continue;
    const age = now - new Date(p.created_at).getTime();
    let stage: "24h" | "7d" | null = null;
    if (!p.onboarding_reminder_24h_at) stage = "24h";
    else if (age >= 7 * DAY && now - new Date(p.onboarding_reminder_24h_at).getTime() >= 3 * DAY) stage = "7d";
    if (!stage) continue;
    out.push({ id: p.id, email: p.email, name: p.full_name ?? "", role: p.role, stage, missing });
  }
  return out;
}


export async function runOnboardingReminders(sb: any, send: boolean) {
    const all = await findCandidates(sb as any);
    const counts = { seller: 0, rider: 0, buyer: 0 };
    for (const c of all) counts[c.role]++;
    if (!send) return { counts, total: all.length, sent: 0, failed: 0, errors: [] as string[] };

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
    // On Vercel there is no Lovable gateway key, so call Resend directly.
    const useGateway = Boolean(LOVABLE_API_KEY);
    const endpoint = useGateway
      ? "https://connector-gateway.lovable.dev/resend/emails"
      : "https://api.resend.com/emails";
    const authHeaders: Record<string, string> = useGateway
      ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
      : { Authorization: `Bearer ${RESEND_API_KEY}` };

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const c of all.slice(0, MAX_PER_RUN)) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          from: FROM,
          to: [c.email],
          subject: (c.stage === "7d" ? "Huling paalala: " : "") + COPY[c.role].subject,
          html: emailHtml(c),
        }),
      });

      if (!res.ok) {
        failed++;
        const body = await res.text();
        console.error(`Resend failed [${res.status}]: ${body}`);
        if (errors.length < 3) errors.push(`[${res.status}] ${body.slice(0, 200)}`);
      } else {
        sent++;
        const col = c.stage === "24h" ? "onboarding_reminder_24h_at" : "onboarding_reminder_7d_at";
        await sb.from("profiles").update({ [col]: new Date().toISOString() } as any).eq("id", c.id);
      }
      await new Promise((r) => setTimeout(r, 550)); // Resend: ~2 emails/second
    }
    return { counts, total: all.length, sent, failed, errors };
}
