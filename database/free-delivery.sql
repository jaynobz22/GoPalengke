-- GoPalengke: Free delivery na sagot ng seller
-- Patakbuhin ito sa SQL Editor ng database.

-- 1) Setting ng bawat tindahan
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS free_delivery_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS free_delivery_min_amount numeric NOT NULL DEFAULT 500;

-- 2) Magkano ang sinagot ng seller na delivery fee sa order na ito
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_delivery_subsidy numeric NOT NULL DEFAULT 0;

-- 3) Klase ng free delivery: 'full' = sagot lahat; 'base_only' = base fee lang
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS free_delivery_type text NOT NULL DEFAULT 'full';
