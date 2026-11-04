import { createClient } from "@supabase/supabase-js";
import { emailCta, emailLayout } from "./email-layout";

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

const GPS_NOTE: Record<Role, string> = {
  seller:
    "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong>. Dito nakadepende kung saang palengke mapapabilang ang tindahan mo at kung paano ka mahahanap ng mga malapit na mamimili at rider.",
  rider:
    "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong> (mas mabuti kung <strong>Always Allow</strong>). Dito gumagana ang GPS navigation, live tracking, at ang tamang kwenta ng distansya at bayad mo.",
  buyer:
    "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong>. Dito nakadepende ang paghahanap ng pinakamalapit na palengke at ang tamang kwenta ng delivery fee papunta sa bahay mo.",
};

function emailHtml(c: Candidate) {
  const copy = COPY[c.role];
  const first = esc((c.name || "Suki").split(" ")[0] ?? "Suki");
  const items = c.missing.map((m) => `<li style="margin:4px 0">${esc(m)}</li>`).join("");
  const lead =
    c.stage === "7d"
      ? "Huling paalala na ito — hindi pa rin kumpleto ang account mo sa GoPalengke."
      : "Salamat sa pag-sign up sa GoPalengke! May ilang bagay pa na kulang sa account mo:";
  const approval =
    c.role === "seller"
      ? "Paalala: kailangan munang kumpleto at ma-approve ng admin ang tindahan mo bago ito makita ng mga mamimili."
      : c.role === "rider"
        ? "Paalala: kailangan munang kumpleto at ma-approve ng admin ang profile mo bago ka makatanggap ng delivery."
        : null;
  const approvalBox = approval
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:12px 14px;margin:0 0 16px;font-size:14px;line-height:1.6;color:#92400e">⏳ ${esc(approval)}</div>`
    : "";
  return emailLayout({
    title: copy.subject,
    preheader: copy.title,
    bodyHtml: `<h1 style="font-size:20px;margin:0 0 12px;color:#111827">${copy.title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Hi ${first},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">${lead}</p>
<ul style="font-size:15px;line-height:1.5;padding-left:20px;margin:8px 0 18px">${items}</ul>
${approvalBox}
<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;margin:0 0 20px">
<div style="font-size:14px;font-weight:bold;color:#1e40af;margin-bottom:6px">📍 Pakibuksan ang Location (GPS)</div>
<div style="font-size:14px;line-height:1.6;color:#1e3a8a">${GPS_NOTE[c.role]}</div>
</div>
${emailCta(copy.cta, `${SITE}/`)}`,
  });
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
