import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Free phone push notification per order event (SMS for orders is on hold to save cost).
// The server checks the caller is part of the order and that the order is really in the
// matching fresh state, so it can't be replayed freely.
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
    const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
    if (!key) return { ok: false, skipped: "not_configured" };
    const { createClient } = await import("@supabase/supabase-js");
    const { GP_URL } = await import("./onboarding-reminders.server");
    const { sendWebPush } = await import("./web-push.server");
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
    const storeName = store?.name || "isang tindahan";

    let to: string | null = null;
    let title = "";
    let body = "";
    let url = "/";
    if (data.event === "new_order") {
      if (caller !== o.buyer_id || o.status !== "pending" || !fresh(o.created_at)) return { ok: false, skipped: "state" };
      to = store?.seller_id;
      title = "May bagong order! 🛒";
      body = `Bagong order sa ${storeName} (₱${Number(o.total).toFixed(2)}). I-confirm na.`;
    } else if (data.event === "rider_assigned") {
      if (caller !== store?.seller_id || !o.rider_id || !fresh(o.updated_at)) return { ok: false, skipped: "state" };
      to = o.rider_id;
      title = "May bagong delivery para sa iyo! 🏍️";
      body = `In-assign ka ng ${storeName}. Buksan ang GoPalengke para tanggapin.`;
    } else {
      if (caller !== o.rider_id || o.status !== "picked_up" || !fresh(o.picked_up_at)) return { ok: false, skipped: "state" };
      to = o.buyer_id;
      title = "On the way na ang order mo! 🚚";
      body = `Dala na ng rider ang order mo mula sa ${storeName}.`;
    }
    if (!to) return { ok: false, skipped: "no_target" };

    const { data: subs } = await sb.from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key").eq("user_id", to).eq("is_active", true);
    let sent = 0;
    for (const s of subs || []) {
      const status = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh_key, auth: s.auth_key },
        { title, body, url, tag: `order-${data.orderId}-${data.event}` }, key);
      if (status === 404 || status === 410) await sb.from("push_subscriptions").update({ is_active: false }).eq("id", s.id);
      else if (status < 300) sent++;
    }
    return { ok: sent > 0, sent };
  });
