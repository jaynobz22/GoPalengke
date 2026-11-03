import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BROADCAST_GROUPS, broadcastRecipients, broadcastHtml, type BroadcastGroup } from "../legacy/lib/roleBroadcast";

// Admin-only role-targeted email: caller token is verified as admin server-side,
// and recipients are resolved on the server so only the chosen group receives it.
async function adminClient(token: string) {
  const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Hindi naka-configure ang server.");
  const { createClient } = await import("@supabase/supabase-js");
  const { GP_URL } = await import("./onboarding-reminders.server");
  const sb = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await sb.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) throw new Error("Hindi naka-login.");
  const { data: p } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (p?.role !== "admin") throw new Error("Admin lang ang pwede.");
  return sb;
}

async function loadRecipients(sb: any, group: BroadcastGroup) {
  if (group === "affiliate") {
    const { data } = await sb.from("affiliates").select("email, full_name");
    return broadcastRecipients(data || [], group);
  }
  const { data } = await sb.from("profiles").select("email, full_name, role")
    .eq("role", group).eq("is_approved", true).eq("is_active", true);
  return broadcastRecipients(data || [], group);
}

const groupSchema = z.enum(BROADCAST_GROUPS);

export const countBroadcastRecipients = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(4000), group: groupSchema }).parse(d))
  .handler(async ({ data }) => {
    const sb = await adminClient(data.token);
    return { count: (await loadRecipients(sb, data.group)).length };
  });

export const sendRoleBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10).max(4000), group: groupSchema,
    subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000),
  }).parse(d))
  .handler(async ({ data }) => {
    const sb = await adminClient(data.token);
    const list = await loadRecipients(sb, data.group);
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    if (!RESEND_API_KEY) throw new Error("Hindi naka-configure ang email sending.");
    const useGateway = Boolean(LOVABLE_API_KEY);
    const endpoint = useGateway ? "https://connector-gateway.lovable.dev/resend/emails" : "https://api.resend.com/emails";
    const auth: Record<string, string> = useGateway
      ? { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY }
      : { Authorization: `Bearer ${RESEND_API_KEY}` };
    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const r of list) {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ from: "GoPalengke Admin <admin@gopalengke.net>", to: [r.email], subject: data.subject, html: broadcastHtml(r.name, data.body) }),
      });
      if (res.ok) sent++;
      else {
        failed++;
        const t = await res.text();
        console.error(`Broadcast failed [${res.status}]: ${t}`);
        if (errors.length < 3) errors.push(`[${res.status}] ${t.slice(0, 160)}`);
      }
      await new Promise((ok) => setTimeout(ok, 550));
    }
    return { total: list.length, sent, failed, errors };
  });
