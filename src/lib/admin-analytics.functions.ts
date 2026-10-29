import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Admin Stats reads all orders server-side after verifying the caller is an admin,
// so browser read rules on orders can't hide other sellers' sales from the dashboard.
const SELECT = `store_id, rider_id, buyer_id, total, commission_amount, delivery_fee, status, created_at,
  store:stores!orders_store_id_fkey(name, palengke_name, city, region, seller:profiles!stores_seller_id_fkey(full_name)),
  rider:profiles!orders_rider_id_fkey(full_name, email, barangay, city),
  buyer:profiles!orders_buyer_id_fkey(full_name, email, barangay, city)`;

export const getAdminAnalyticsOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
    if (!key) return { ok: false as const, orders: [] };
    const { createClient } = await import("@supabase/supabase-js");
    const { GP_URL } = await import("./onboarding-reminders.server");
    const sb = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u } = await sb.auth.getUser(data.token);
    const uid = u?.user?.id;
    if (!uid) return { ok: false as const, orders: [] };
    const { data: p } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (p?.role !== "admin") return { ok: false as const, orders: [] };
    const { data: orders, error } = await sb.from("orders").select(SELECT).order("created_at", { ascending: false }).limit(2000);
    if (error) { console.error("admin analytics", error); return { ok: false as const, orders: [] }; }
    return { ok: true as const, orders: (orders || []) as any[] };
  });
