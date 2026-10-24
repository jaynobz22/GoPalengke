-- Apply to the owner's existing GoPalengke database, not the separate Cloud copy.
-- Arrival keeps status picked_up; delivery/commission triggers remain unchanged.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_arrived_buyer_at timestamptz;