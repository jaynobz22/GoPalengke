/*
# Fleet Classification & Distance Tracking

1. Schema Changes
- `profiles`: add `vehicle_type` text column (values: 'motorcycle', 'tricycle', 'minivan')
  and `rider_lto_or_cr_url` text column for LTO OR/CR document upload.
- `orders`: add `distance_km` numeric column (navigable road distance) and
  `vehicle_type` text column (the fleet tier assigned at checkout).

2. Indexes
- Add index on `profiles(vehicle_type)` for fleet filtering queries.

3. Updated Trigger: notify_rider_on_ready_pickup
- Now filters available riders by vehicle_type compatibility with the order's
  cargo weight. Orders >20kg only notify tricycle/minivan riders. Orders >150kg
  only notify minivan riders.
*/

-- Add vehicle_type and LTO OR/CR to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'motorcycle';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rider_lto_or_cr_url text;

-- Add distance_km and vehicle_type to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_km numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'motorcycle';

-- Index for fleet filtering
CREATE INDEX IF NOT EXISTS profiles_vehicle_type_idx ON profiles(vehicle_type)
  WHERE vehicle_type IS NOT NULL;

-- Update the rider notification trigger to filter by vehicle capacity
CREATE OR REPLACE FUNCTION trigger_notify_rider_ready_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_name text;
  v_rider RECORD;
  v_order_weight numeric := 0;
  v_required_tier text := 'motorcycle';
BEGIN
  IF NEW.status = 'ready_for_pickup' AND (OLD.status IS DISTINCT FROM 'ready_for_pickup') THEN
    IF NEW.delivery_method IS NOT NULL THEN RETURN NEW; END IF;

    -- Determine required vehicle tier from the order's vehicle_type
    v_required_tier := COALESCE(NEW.vehicle_type, 'motorcycle');

    SELECT name INTO v_store_name FROM stores WHERE id = NEW.store_id;

    -- Notify available riders whose vehicle_type matches or exceeds the required tier
    FOR v_rider IN
      SELECT p.id, p.vehicle_type FROM profiles p
      WHERE p.role = 'rider'
        AND p.is_available = true
        AND p.is_approved = true
        AND p.is_active = true
        AND p.city = (SELECT city FROM stores WHERE id = NEW.store_id)
        AND (
          (v_required_tier = 'motorcycle' AND p.vehicle_type IN ('motorcycle', 'tricycle', 'minivan'))
          OR
          (v_required_tier = 'tricycle' AND p.vehicle_type IN ('tricycle', 'minivan'))
          OR
          (v_required_tier = 'minivan' AND p.vehicle_type = 'minivan')
        )
    LOOP
      PERFORM notify_push(
        v_rider.id,
        'rider',
        'New Delivery Available! 🏍️',
        'Earn from a new trip waiting at ' || COALESCE(v_store_name, 'GoPalengke') || '.',
        '/rider'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
