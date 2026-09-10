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

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  target_role: string;
  target_region: string | null;
  target_city: string | null;
  target_barangay: string | null;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load campaign
    const { data: campaign, error: campError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const c = campaign as CampaignRow;

    // Check if email sending is enabled
    const { data: sendingEnabledRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "EMAIL_SENDING_ENABLED")
      .maybeSingle();
    const sendingEnabled = (sendingEnabledRow as { value: string } | null)?.value;
    if (sendingEnabled === "false") {
      return new Response(JSON.stringify({ error: "Email sending is currently disabled by the admin. Enable it in Settings first." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Resend API key from platform_settings
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "RESEND_API_KEY")
      .maybeSingle();

    const resendKey = (setting as { value: string } | null)?.value || Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "No Resend API key configured. Set RESEND_API_KEY in admin Settings." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as sending
    await supabase
      .from("email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    // Build recipient query from profiles
    let profileQuery = supabase
      .from("profiles")
      .select("id, email, full_name, role, region, city, barangay")
      .eq("is_approved", true)
      .eq("is_active", true)
      .not("email", "is", null);

    if (c.target_role !== "all") {
      profileQuery = profileQuery.eq("role", c.target_role);
    }
    if (c.target_region) {
      profileQuery = profileQuery.eq("region", c.target_region);
    }
    if (c.target_city) {
      profileQuery = profileQuery.eq("city", c.target_city);
    }
    if (c.target_barangay) {
      profileQuery = profileQuery.eq("barangay", c.target_barangay);
    }

    const { data: profiles, error: profError } = await profileQuery;
    if (profError) {
      throw new Error(`Failed to load profiles: ${profError.message}`);
    }

    const recipients = (profiles || []).filter((p: { email: string | null }) => p.email);

    if (recipients.length === 0) {
      await supabase
        .from("email_campaigns")
        .update({ status: "sent", sent_count: 0, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert recipient rows
    const recipientRows = recipients.map((p: any) => ({
      campaign_id: campaignId,
      user_id: p.id,
      email: p.email,
      full_name: p.full_name,
      status: "pending",
    }));

    await supabase
      .from("email_campaign_recipients")
      .insert(recipientRows);

    // Send emails in batches of 50 via Resend
    const BATCH_SIZE = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const emails = batch.map((p: any) => ({
        from: "GoPalengke <noreply@gopalengke.net>",
        to: [p.email],
        subject: c.subject,
        html: buildEmailHtml(c.body, p.full_name || ""),
      }));

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emails),
      });

      if (res.ok) {
        for (const p of batch) {
          await supabase
            .from("email_campaign_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("campaign_id", campaignId)
            .eq("email", (p as any).email);
          sentCount++;
        }
      } else {
        const errBody = await res.text();
        for (const p of batch) {
          await supabase
            .from("email_campaign_recipients")
            .update({ status: "failed", error_message: errBody.slice(0, 500) })
            .eq("campaign_id", campaignId)
            .eq("email", (p as any).email);
          failedCount++;
        }
      }
    }

    // Update campaign status
    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return new Response(JSON.stringify({
      sent: sentCount,
      failed: failedCount,
      total: recipients.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(body: string, fullName: string): string {
  const greeting = fullName ? `Kamusta ${fullName}!` : "Kamusta!";
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
              <div style="font-size:15px;line-height:1.7;color:#4b5563;white-space:pre-wrap;">${escapeHtml(body)}</div>
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
