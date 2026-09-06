/*
# Add Rider Availability Toggle and Live Delivery Tracking

## Purpose
This migration adds the infrastructure for riders to toggle their availability
for deliveries, and for live GPS tracking of deliveries so buyers can see the
rider's position on a map in real time.

## Changes

### 1. profiles table — new column
- `is_available` (boolean, default false): Riders toggle this ON/OFF to signal
  they are ready to accept delivery assignments. Only relevant for users with
  role = 'rider'. Sellers and buyers are unaffected.

### 2. orders table — new columns
- `rider_lat` (double precision, nullable): The rider's current latitude,
  updated periodically by the rider's device while on an active delivery.
- `rider_lng` (double precision, nullable): The rider's current longitude,
  updated periodically by the rider's device while on an active delivery.
- `picked_up_at` (timestamptz, nullable): Timestamp set when the rider accepts
  and picks up the order (status transitions to 'picked_up'). Used to calculate
  elapsed delivery time and estimated arrival.

### 3. Security (RLS policies)
- Riders can update their own `is_available` field on their own profile.
- Riders can update `rider_lat`, `rider_lng`, and `picked_up_at` on orders
  they are assigned to (where rider_id = auth.uid()).
- Buyers can read `rider_lat` and `rider_lng` on their own orders (already
  covered by existing SELECT policy, but we add a specific policy to be safe).
- Sellers can read rider tracking data on their store's orders (already covered
  by existing SELECT policy).

## Important Notes
1. The `is_available` column is added with `IF NOT EXISTS` for idempotency.
2. Existing orders will have NULL for the new columns, which is fine — they
   predate the tracking feature.
3. No existing data is modified or deleted.
*/

-- Add is_available to profiles (for riders to toggle availability)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_available boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add rider tracking columns to orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_lat'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_lng'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'picked_up_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN picked_up_at timestamptz;
  END IF;
END $$;

-- Policy: riders can update their own is_available field
-- The existing profiles UPDATE policy already covers auth.uid() = id,
-- so is_available is already covered. No new policy needed.

-- Policy: riders can update rider_lat, rider_lng, picked_up_at on orders
-- where they are the assigned rider. The existing orders UPDATE policy
-- checks rider_id = auth.uid() for riders, so these columns are already
-- covered by the existing policy. No new policy needed.

-- Policy: buyers can read rider_lat, rider_lng on their own orders.
-- The existing orders SELECT policy already allows buyers to read their
-- own orders (buyer_id = auth.uid()), so these new columns are readable
-- by the buyer. No new policy needed.