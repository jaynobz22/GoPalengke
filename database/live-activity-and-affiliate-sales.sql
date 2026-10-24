-- Run once in the GoPalengke database (SQL editor).
-- 1) Public, privacy-safe recent activity for the bottom pop-up (no names, no buyer data).
CREATE OR REPLACE FUNCTION public.recent_public_activity(p_limit int DEFAULT 12)
RETURNS TABLE(id text, kind text, product_name text, quantity numeric, unit text, store_name text, place text, barangay text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT 'order-' || o.id::text, 'order', oi.product_name, oi.quantity, oi.unit,
          s.name, COALESCE(s.palengke_name, s.barangay), NULL::text, o.created_at
     FROM public.orders o
     JOIN public.stores s ON s.id = o.store_id
     JOIN LATERAL (SELECT product_name, quantity, unit FROM public.order_items WHERE order_id = o.id LIMIT 1) oi ON true
    WHERE o.status <> 'cancelled' AND o.created_at > now() - interval '14 days'
    ORDER BY o.created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 30)))
  UNION ALL
  (SELECT 'pickup-' || o.id::text, 'rider', NULL, NULL, NULL, NULL, NULL, o.delivery_barangay, o.updated_at
     FROM public.orders o
    WHERE o.status IN ('picked_up','delivered') AND o.rider_id IS NOT NULL AND o.updated_at > now() - interval '14 days'
    ORDER BY o.updated_at DESC LIMIT 6)
$$;
GRANT EXECUTE ON FUNCTION public.recent_public_activity(int) TO anon, authenticated;

-- 2) Sales of sellers referred by an affiliate (delivered orders), for the affiliate dashboard.
CREATE OR REPLACE FUNCTION public.affiliate_referral_sales(p_affiliate_id uuid)
RETURNS TABLE(referral_id uuid, delivered_sales numeric, delivered_orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, COALESCE(SUM(o.total), 0), COUNT(o.id)
    FROM public.affiliate_referrals r
    LEFT JOIN public.stores s ON s.seller_id = r.referred_user_id
    LEFT JOIN public.orders o ON o.store_id = s.id AND o.status = 'delivered'
   WHERE r.affiliate_id = p_affiliate_id AND r.referred_role = 'seller'
   GROUP BY r.id
$$;
GRANT EXECUTE ON FUNCTION public.affiliate_referral_sales(uuid) TO anon, authenticated;
