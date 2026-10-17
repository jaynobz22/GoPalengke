import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone } from "./phone";

// One SMS per order event via Twilio Messaging. The server checks the caller is part of the
// order and that the order is really in the matching fresh state, so it can't be replayed freely.
const FRESH_MS = 10 * 60 * 1000;

export const sendOrderSms = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token: z.string().min(10).max(4000),
      orderId: z.string().uuid(),
      event: z.enum(["new_order", "rider_assigned", "on_the_way"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const authTok = process.env["TWILIO_AUTH_TOKEN"];
    const from = process.env["TWILIO_SMS_FROM"];
    const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
    if (!sid || !authTok || !from || !key) return { ok: false, skipped: "not_configured" };
    const { createClient } = await import("@supabase/supabase-js");
    const { GP_URL } = await import("./onboarding-reminders.server");
    const sb = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: u } = await sb.auth.getUser(data.token);
    const caller = u?.user?.id;
    if (!caller) return { ok: false, skipped: "auth" };

    const { data: o } = await sb.from("orders")
      .select("id, buyer_id, rider_id, status, created_at, picked_up_at, updated_at, total, store:stores(name, seller_id)")
      .eq("id", data.orderId).maybeSingle();
    if (!o) return { ok: false, skipped: "no_order" };
    const store: any = Array.isArray((o as any).store) ? (o as any).store[0] : (o as any).store;
    const now = Date.now();
    const fresh = (t?: string | null) => !!t && now - new Date(t).getTime() < FRESH_MS;

    let to: string | null = null;
    let body = "";
    const storeName = store?.name || "isang tindahan";
    if (data.event === "new_order") {
      if (caller !== o.buyer_id || o.status !== "pending" || !fresh(o.created_at)) return { ok: false, skipped: "state" };
      to = store?.seller_id;
      body = `GoPalengke: May bagong order sa ${storeName} (P${Number(o.total).toFixed(2)}). Buksan ang app para i-confirm.`;
    } else if (data.event === "rider_assigned") {
      if (caller !== store?.seller_id || !o.rider_id || !fresh(o.updated_at)) return { ok: false, skipped: "state" };
      to = o.rider_id;
      body = `GoPalengke: May bagong delivery na naka-assign sa iyo mula sa ${storeName}. Buksan ang app para tanggapin.`;
    } else {
      if (caller !== o.rider_id || o.status !== "picked_up" || !fresh(o.picked_up_at)) return { ok: false, skipped: "state" };
      to = o.buyer_id;
      body = `GoPalengke: On the way na ang rider dala ang order mo mula sa ${storeName}. Ihanda ang bayad kung COD.`;
    }

    const { data: p } = await sb.from("profiles").select("phone").eq("id", to).maybeSingle();
    const e164 = p?.phone ? normalizePhone(p.phone) : null;
    if (!e164) return { ok: false, skipped: "no_phone" };

    const params = new URLSearchParams({ To: e164, Body: body });
    params.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${authTok}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) {
      console.error(`Twilio SMS failed [${res.status}]`, await res.text());
      return { ok: false, skipped: "twilio" };
    }
    return { ok: true };
  });
