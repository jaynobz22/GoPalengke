import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load the user's profile
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (profError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p = profile as ProfileRow;
    if (!p.email) {
      return new Response(
        JSON.stringify({ error: "User has no email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if we already sent a welcome email to this user (idempotent)
    const { data: existing } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", `welcome_email_sent_${userId}`)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ sent: false, message: "Welcome email already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if email sending is enabled
    const { data: sendingEnabledRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "EMAIL_SENDING_ENABLED")
      .maybeSingle();
    const sendingEnabled = (sendingEnabledRow as { value: string } | null)?.value;
    if (sendingEnabled === "false") {
      return new Response(
        JSON.stringify({ error: "Email sending is currently disabled by the admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load the email provider API key
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "EMAIL_PROVIDER_KEY")
      .maybeSingle();

    const resendKey = (setting as { value: string } | null)?.value;
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Walang email provider API key na naka-configure." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = buildWelcomeEmailHtml(p.role, p.full_name || "");
    const subject = "Mabuhay! Welcome to GoPalengke!";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GoPalengke <noreply@gopalengke.net>",
        to: [p.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${errBody.slice(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark as sent so we don't send again
    await supabase
      .from("platform_settings")
      .insert({ key: `welcome_email_sent_${userId}`, value: "true" });

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function buildWelcomeEmailHtml(role: string, fullName: string): string {
  const greeting = fullName ? `Kamusta ${fullName}!` : "Kamusta!";

  let roleContent = "";

  if (role === "seller") {
    roleContent = `
      <p style="margin:0 0 12px;">Bilang seller sa GoPalengke, narito ang mga susi sa tagumpay mo:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:#4b5563;">
        <li>I-set up ang iyong tindahan — lagyan ng larawan, deskripsyon, at presyo ang bawat paninda</li>
        <li>Magpadala ng mga larawan para sa verification (Valid ID, tindahan/farm, selfie hawak ang ID)</li>
        <li>Tanggapin at ihanda ang mga order, at hintayin ang rider na kunin ito</li>
        <li>Siguraduhing bukas ang tindahan mo (Store Open) para makita ng buyers</li>
      </ul>`;
  } else if (role === "rider") {
    roleContent = `
      <p style="margin:0 0 12px;">Bilang rider sa GoPalengke, narito ang mga hakbang para makapag-deliver ka na:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:#4b5563;">
        <li>I-set ang iyong availability sa Deliveries tab</li>
        <li>Pumili ng available na delivery na malapit sa iyo</li>
        <li>Kunin ang paninda sa tindahan at ihatid sa buyer</li>
        <li>Kumita ng delivery fee sa bawat successful delivery!</li>
      </ul>`;
  } else {
    roleContent = `
      <p style="margin:0 0 12px;">Bilang buyer sa GoPalengke, narito ang paano mag-order:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:#4b5563;">
        <li>Mag-browse ng mga tindahan sa homepage</li>
        <li>Piliin ang paninda at dagdagan sa cart</li>
        <li>Checkout at hintayin ang seller na tanggapin ang order</li>
        <li>Magbayad via QR code o cash on delivery</li>
        <li>Ihatid ng rider ang order mo sa iyong address!</li>
      </ul>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:20px 32px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;"><img src="https://gopalengke.net/images/Copilot_20260907_183703.png" alt="GoPalengke" width="40" height="40" style="border-radius:10px;display:block;" /></td>
                <td><h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">GoPalengke</h1></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1f2937;">${greeting}</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4b5563;">Ang GoPalengke ang unang online wet market platform sa Pilipinas — nag-uugnay ng mga tindahan sa palengke at farm sa mga buyers sa pamamagitan ng app. Mag-order ka ng sariwang isda, karne, gulay, at iba pang paninda, at idedeliver diretso sa iyong bahay!</p>
              ${roleContent}
              <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1f2937;">Mga Mahalagang Link:</p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr><td style="padding:4px 0;"><a href="https://gopalengke.net/tutorial" style="color:#16a34a;text-decoration:none;font-size:14px;">Video Tutorial</a></td></tr>
                <tr><td style="padding:4px 0;"><a href="https://gopalengke.net/affiliate" style="color:#16a34a;text-decoration:none;font-size:14px;">Affiliate Program</a></td></tr>
                <tr><td style="padding:4px 0;"><a href="https://gopalengke.net/terms" style="color:#16a34a;text-decoration:none;font-size:14px;">Terms of Service</a></td></tr>
                <tr><td style="padding:4px 0;"><a href="https://gopalengke.net/privacy" style="color:#16a34a;text-decoration:none;font-size:14px;">Privacy Policy</a></td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="https://gopalengke.net" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">Mag-shopping na sa GoPalengke</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Nakatanggap ka ng email na ito dahil rehistrado ka sa GoPalengke.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
