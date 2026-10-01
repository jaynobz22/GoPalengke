// Welcome email na ipinapadala pagkatapos ma-verify ang 8-digit code ng bagong user.
// Role-specific ang checklist (seller / rider / buyer) at may paalala sa GPS location access.

const SITE = "https://www.gopalengke.net";
const TUTORIAL = "https://www.gopalengke.net/tutorial";
const FROM = "GoPalengke <admin@gopalengke.net>";

type Role = "seller" | "rider" | "buyer";

type RoleCopy = {
  subject: string;
  title: string;
  intro: string;
  approvalNote: string | null;
  checklist: string[];
  gps: string;
  cta: string;
};

const COPY: Record<Role, RoleCopy> = {
  seller: {
    subject: "Maligayang pagdating sa GoPalengke! I-setup na ang tindahan mo",
    title: "Welcome, Ka-Tindera/Ka-Tindero!",
    intro:
      "Na-verify na ang email mo. Konti na lang at bukas na ang tindahan mo sa GoPalengke.",
    approvalNote:
      "Paalala: kailangan munang kumpleto ang tindahan mo at ma-approve ng admin bago ito makita at mabilhan ng mga mamimili.",
    checklist: [
      "Kumpletuhin ang detalye ng tindahan (pangalan, deskripsyon, palengke)",
      "Mag-upload ng profile picture",
      "Mag-upload ng store banner o larawan ng tindahan",
      "Mag-upload ng GCash / Maya QR code para sa bayad",
      "Mag-post ng iyong unang paninda (may presyo kada kilo)",
    ],
    gps: "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong>. Dito nakadepende ang tamang pagkakalagay ng tindahan mo sa mapa, kung aling palengke ka mapapabilang, at kung paano ka mahahanap ng mga malapit na mamimili at rider.",
    cta: "I-setup ang Tindahan Ko",
  },
  rider: {
    subject: "Maligayang pagdating sa GoPalengke! Kumpletuhin ang rider profile mo",
    title: "Welcome, Ka-Rider!",
    intro:
      "Na-verify na ang email mo. Kumpletuhin na lang ang mga requirement at makakabiyahe ka na.",
    approvalNote:
      "Paalala: kailangan munang kumpleto ang profile mo at ma-approve ng admin bago ka makatanggap ng delivery.",
    checklist: [
      "Mag-upload ng malinaw na profile picture",
      "Ilagay ang plate number ng motor o sasakyan mo",
      "Mag-upload ng valid ID para sa beripikasyon",
      "I-on ang iyong Available status kapag handa nang bumiyahe",
    ],
    gps: "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong> (mas mabuti kung <strong>Always Allow</strong>). Dito gumagana ang GPS navigation papunta sa tindahan at sa bahay ng buyer, ang live tracking, at ang tamang kwenta ng distansya at bayad mo.",
    cta: "Kumpletuhin ang Rider Profile",
  },
  buyer: {
    subject: "Maligayang pagdating sa GoPalengke! Kumpletuhin ang profile mo",
    title: "Welcome, Suki!",
    intro:
      "Na-verify na ang email mo. Konti na lang at makakabili ka na ng sariwang paninda mula sa palengke.",
    approvalNote: null,
    checklist: [
      "Mag-upload ng profile picture",
      "Mag-upload ng picture ng bahay mo (malaking tulong para madaling mahanap ng rider)",
      "Siguraduhing tama ang delivery address at numero mo",
    ],
    gps: "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong>. Dito nakadepende ang paghahanap ng pinakamalapit na palengke at tindahan sa iyo, at ang tamang kwenta ng delivery fee papunta sa bahay mo.",
    cta: "Kumpletuhin ang Profile Ko",
  },
};

function esc(s: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export function welcomeEmailHtml(role: Role, name: string) {
  const copy = COPY[role];
  const first = esc((name || "Suki").split(" ")[0] ?? "Suki");
  const items = copy.checklist
    .map((m) => `<li style="margin:6px 0">${esc(m)}</li>`)
    .join("");
  const approval = copy.approvalNote
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 16px;margin:0 0 18px">
<div style="font-size:14px;font-weight:bold;color:#92400e;margin-bottom:4px">⏳ Pending approval muna</div>
<div style="font-size:14px;line-height:1.6;color:#92400e">${esc(copy.approvalNote)}</div></div>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#15803d;border-radius:16px 16px 0 0;padding:20px 24px;color:#ffffff">
<div style="font-size:22px;font-weight:bold">GoPalengke</div>
<div style="font-size:13px;opacity:.9">Online palengke ng bayan</div></div>
<div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(copy.title)}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Hi ${first},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(copy.intro)}</p>
${approval}
<div style="font-size:15px;font-weight:bold;margin:0 0 6px">Mga dapat mong tapusin:</div>
<ul style="font-size:15px;line-height:1.5;padding-left:20px;margin:6px 0 20px">${items}</ul>

<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;margin:0 0 20px">
<div style="font-size:14px;font-weight:bold;color:#1e40af;margin-bottom:6px">📍 Pakibuksan ang Location (GPS)</div>
<div style="font-size:14px;line-height:1.6;color:#1e3a8a">${copy.gps}</div>
</div>

<a href="${SITE}/" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${esc(copy.cta)}</a>

<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:22px 0 0">
<div style="font-size:14px;font-weight:bold;margin-bottom:4px">🎬 Panoorin muna ang mga tutorial</div>
<div style="font-size:14px;line-height:1.6;color:#4b5563">May mga maikling video kung paano gamitin ang GoPalengke step by step.</div>
<a href="${TUTORIAL}" style="display:inline-block;margin-top:8px;color:#15803d;font-weight:bold;text-decoration:underline;font-size:14px">Buksan ang Tutorials</a>
</div>

<p style="font-size:13px;color:#6b7280;margin:24px 0 0">Kung hindi mo pa matapos sa loob ng 24 oras, may ipapadala kaming paalala. May tanong? I-reply lang ang email na ito.</p>
</div></div></body></html>`;
}

export async function sendWelcomeEmailFor(sb: any, userId: string) {
  const { data: prof, error } = await sb
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prof?.email) return { sent: false, reason: "walang email" };

  const role = prof.role as Role;
  if (role !== "seller" && role !== "rider" && role !== "buyer") {
    return { sent: false, reason: "hindi kasama ang role na ito" };
  }

  // Idempotency: kung may column na welcome_email_sent_at at punu-puno na, huwag ulitin.
  const { data: flag } = await sb
    .from("profiles")
    .select("welcome_email_sent_at")
    .eq("id", userId)
    .maybeSingle();
  if (flag && flag.welcome_email_sent_at) {
    return { sent: false, reason: "naipadala na dati" };
  }

  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
  const useGateway = Boolean(LOVABLE_API_KEY);
  const endpoint = useGateway
    ? "https://connector-gateway.lovable.dev/resend/emails"
    : "https://api.resend.com/emails";
  const authHeaders: Record<string, string> = useGateway
    ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
    : { Authorization: `Bearer ${RESEND_API_KEY}` };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      from: FROM,
      to: [prof.email],
      subject: COPY[role].subject,
      html: welcomeEmailHtml(role, prof.full_name ?? ""),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Welcome email failed [${res.status}]: ${body}`);
    throw new Error(`Hindi naipadala ang welcome email [${res.status}]: ${body.slice(0, 200)}`);
  }

  // Best-effort: markahan na naipadala na (gagana kapag naidagdag na ang column).
  try {
    await sb
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* walang column pa — ok lang */
  }

  return { sent: true, role };
}
