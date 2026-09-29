-- Rider accept flow: oras kung kailan tinanggap ng rider ang delivery
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_accepted_at timestamptz;

-- Lahat ng lumang order na naka-picked_up/delivered ay ituring na tinanggap na
UPDATE public.orders SET rider_accepted_at = COALESCE(picked_up_at, updated_at)
WHERE rider_id IS NOT NULL AND rider_accepted_at IS NULL AND status IN ('picked_up', 'delivered');
