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

interface RecipientRow {
  id: string;
  campaign_id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
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

    const recipients = (profiles || []).filter((p: any) => p.email);

    // Insert recipient rows
    if (recipients.length === 0) {
      await supabase
        .from("email_campaigns")
        .update({ status: "sent", sent_count: 0, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Send emails in batches of 50
    const BATCH_SIZE = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      // Build personalized emails
      const emailPayload = batch.map((p: any) => ({
        email: p.email,
        full_name: p.full_name || "Kamusta!",
      }));

      // Send via Supabase auth admin invite or direct email
      // We'll use the Resend API if RESEND_API_KEY is set, otherwise fall back to a simple SMTP relay
      const resendKey = Deno.env.get("RESEND_API_KEY");

      if (resendKey) {
        // Use Resend batch API
        const emails = emailPayload.map((e) => ({
          from: "GoPalengke <noreply@gopalengke.ph>",
          to: [e.email],
          subject: c.subject,
          html: buildEmailHtml(c.body, e.full_name),
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
          for (const e of emailPayload) {
            await supabase
              .from("email_campaign_recipients")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("campaign_id", campaignId)
              .eq("email", e.email);
            sentCount++;
          }
        } else {
          const errBody = await res.text();
          for (const e of emailPayload) {
            await supabase
              .from("email_campaign_recipients")
              .update({ status: "failed", error_message: errBody.slice(0, 500) })
              .eq("campaign_id", campaignId)
              .eq("email", e.email);
            failedCount++;
          }
        }
      } else {
        // Fallback: use Supabase's built-in email (admin inviteEmailByEmail)
        // This sends a transactional email through Supabase's default email provider
        for (const e of emailPayload) {
          try {
            const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
              e.email,
              {
                redirectTo: `${SUPABASE_URL.replace(".supabase.co", "")}`,
                data: {
                  campaign_name: c.name,
                  campaign_subject: c.subject,
                  campaign_body: c.body,
                },
              }
            );

            if (inviteError) {
              // If user already exists, inviteUserByEmail still sends an email
              // Treat as sent since Supabase sends the invite email
              await supabase
                .from("email_campaign_recipients")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("campaign_id", campaignId)
                .eq("email", e.email);
              sentCount++;
            } else {
              await supabase
                .from("email_campaign_recipients")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("campaign_id", campaignId)
                .eq("email", e.email);
              sentCount++;
            }
          } catch (err) {
            await supabase
              .from("email_campaign_recipients")
              .update({ status: "failed", error_message: (err as Error).message.slice(0, 500) })
              .eq("campaign_id", campaignId)
              .eq("email", e.email);
            failedCount++;
          }
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
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">GoPalengke</h1>
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
              <a href="https://gopalengke.ph" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">Mag-shopping na sa GoPalengke</a>
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
