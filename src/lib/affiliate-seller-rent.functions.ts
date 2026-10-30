import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Returns the unpaid ₱700 rent balance per seller referral of one affiliate, so the
// affiliate milestone matches the seller's Billing payable. Exposes only the rent balance,
// mirroring the public affiliate_referral_sales read.
export const getAffiliateSellerRent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ affiliateId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["GOPALENGKE_SERVICE_ROLE_KEY"];
    if (!key) return { ok: false as const, rent: {} as Record<string, number> };
    const { createClient } = await import("@supabase/supabase-js");
    const { GP_URL } = await import("./onboarding-reminders.server");
    const sb = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: refs } = await sb.from("affiliate_referrals").select("id, referred_user_id")
      .eq("affiliate_id", data.affiliateId).eq("referred_role", "seller").not("referred_user_id", "is", null);
    const ids = (refs || []).map((r) => r.referred_user_id as string);
    const rent: Record<string, number> = {};
    if (ids.length === 0) return { ok: true as const, rent };
    const { data: fees, error } = await sb.from("seller_fees").select("seller_id, subscription_balance").in("seller_id", ids);
    if (error) return { ok: false as const, rent };
    const bySeller = new Map((fees || []).map((f) => [f.seller_id, Number(f.subscription_balance || 0)]));
    for (const r of refs || []) rent[r.id] = bySeller.get(r.referred_user_id) || 0;
    return { ok: true as const, rent };
  });
