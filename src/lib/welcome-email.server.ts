// Welcome email na ipinapadala pagkatapos ma-verify ang 8-digit code ng bagong user.
// Role-specific ang checklist (seller / rider / buyer) at may paalala sa GPS location access.

const SITE = "https://www.gopalengke.net";
const TUTORIAL = "https://www.gopalengke.net/tutorial";
const AFFILIATE = "https://www.gopalengke.net/affiliate";
const TERMS = "https://www.gopalengke.net/legal/terms";
const PRIVACY = "https://www.gopalengke.net/legal/privacy";
const LOGO = "https://www.gopalengke.net/images/Copilot_20260907_183703.jpg";
const FROM = "GoPalengke Admin <admin@gopalengke.net>";

type Role = "seller" | "rider" | "buyer";

type RoleCopy = {
  subject: string;
  roleLabel: string;
  approvalNote: string | null;
  checklist: string[];
  gps: string;
  cta: string;
};

const COPY: Record<Role, RoleCopy> = {
  seller: {
    subject: "Welcome to GoPalengke! I-setup na ang tindahan mo",
    roleLabel: "Seller",
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
    cta: "I-setup ang Tindahan Ngayon",
  },
  rider: {
    subject: "Welcome to GoPalengke! Kumpletuhin ang rider profile mo",
    roleLabel: "Rider",
    approvalNote:
      "Paalala: kailangan munang kumpleto ang profile mo at ma-approve ng admin bago ka makatanggap ng delivery.",
    checklist: [
      "Mag-upload ng malinaw na profile picture",
      "Ilagay ang plate number ng motor o sasakyan mo",
      "Mag-upload ng valid ID para sa beripikasyon",
      "I-on ang iyong Available status kapag handa nang bumiyahe",
    ],
    gps: "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong> (mas mabuti kung <strong>Always Allow</strong>). Dito gumagana ang GPS navigation papunta sa tindahan at sa bahay ng buyer, ang live tracking, at ang tamang kwenta ng distansya at bayad mo.",
    cta: "Kumpletuhin ang Profile Ngayon",
  },
  buyer: {
    subject: "Welcome to GoPalengke! Kumpletuhin ang profile mo",
    roleLabel: "Buyer",
    approvalNote: null,
    checklist: [
      "Mag-upload ng profile picture",
      "Mag-upload ng picture ng bahay mo (malaking tulong para madaling mahanap ng rider)",
      "Siguraduhing tama ang delivery address at numero mo",
    ],
    gps: "Kapag humingi ang GoPalengke ng location access, pindutin ang <strong>Allow / Payagan</strong>. Dito nakadepende ang paghahanap ng pinakamalapit na palengke at tindahan sa iyo, at ang tamang kwenta ng delivery fee papunta sa bahay mo.",
    cta: "Mag-shopping Ngayon",
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
  const displayName = esc(name?.trim() || "Suki");
  const items = copy.checklist
    .map(
      (m) =>
        `<tr><td style="vertical-align:top;padding:5px 10px 5px 0;font-size:15px;line-height:1.5;color:#16a34a;font-weight:bold">&#10003;</td>
<td style="vertical-align:top;padding:5px 0;font-size:15px;line-height:1.55;color:#374151">${esc(m)}</td></tr>`,
    )
    .join("");

  const approval = copy.approvalNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
<td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 16px">
<div style="font-size:14px;font-weight:bold;color:#92400e;margin-bottom:4px">&#9203; Pending approval muna</div>
<div style="font-size:14px;line-height:1.6;color:#92400e">${esc(copy.approvalNote)}</div>
</td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="tl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to GoPalengke</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Welcome to GoPalengke! Mga dapat mong gawin para ma-activate ang account mo.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">

  <tr><td style="background:#15803d;padding:26px 24px" align="center">
    <img src="${LOGO}" width="64" height="64" alt="GoPalengke" style="display:block;border-radius:16px;border:3px solid rgba(255,255,255,.35);margin:0 auto 10px">
    <div style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:.3px">GoPalengke</div>
    <div style="font-size:13px;color:#dcfce7;margin-top:2px">The First Online Wet Market sa Pilipinas</div>
  </td></tr>

  <tr><td style="padding:28px 24px">

    <h1 style="font-size:20px;line-height:1.4;margin:0 0 16px;color:#111827">
      Hello ${displayName}, Welcome to GoPalengke! The First Online Wet Market sa Pilipinas!
    </h1>

    <p style="font-size:15px;line-height:1.65;margin:0 0 18px;color:#374151">
      Maraming salamat sa pag sign up bilang isang <strong>${esc(copy.roleLabel)}</strong>.
      Mga dapat mong gawin ngayon upang maging active ang iyong account:
    </p>

    ${approval}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 20px">
      <tr><td style="padding:14px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
      <td style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px">
        <div style="font-size:14px;font-weight:bold;color:#1e40af;margin-bottom:6px">&#128205; Pakibuksan ang Location (GPS)</div>
        <div style="font-size:14px;line-height:1.6;color:#1e3a8a">${copy.gps}</div>
      </td></tr></table>

    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
      <td align="center" bgcolor="#16a34a" style="border-radius:12px">
        <a href="${SITE}/" style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${esc(copy.cta)}</a>
      </td></tr></table>

  </td></tr>

  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 24px" align="center">
    <div style="font-size:13px;font-weight:bold;color:#374151;margin-bottom:10px">Mga Mahalagang Link</div>
    <div style="font-size:14px;line-height:2;color:#15803d">
      <a href="${TUTORIAL}" style="color:#15803d;text-decoration:none;font-weight:bold">Video Tutorial</a>
      <span style="color:#d1d5db">&nbsp;&bull;&nbsp;</span>
      <a href="${AFFILIATE}" style="color:#15803d;text-decoration:none;font-weight:bold">Affiliate Program</a>
      <span style="color:#d1d5db">&nbsp;&bull;&nbsp;</span>
      <a href="${TERMS}" style="color:#15803d;text-decoration:none;font-weight:bold">Terms of Service</a>
      <span style="color:#d1d5db">&nbsp;&bull;&nbsp;</span>
      <a href="${PRIVACY}" style="color:#15803d;text-decoration:none;font-weight:bold">Privacy Policy</a>
    </div>
  </td></tr>

  <tr><td style="background:#ffffff;border-top:1px solid #e5e7eb;padding:16px 24px" align="center">
    <div style="font-size:12px;line-height:1.6;color:#9ca3af">
      Kung hindi mo pa matapos sa loob ng 24 oras, may ipapadala kaming paalala.<br>
      May tanong? I-reply lang ang email na ito.<br>
      &copy; GoPalengke &mdash; Online palengke ng bayan
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
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
