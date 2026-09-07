/*
# Add Rider Identity Verification Fields

## Purpose
Riders must provide detailed identity information so buyers know who is delivering their orders.
This migration adds verification columns to the existing `profiles` table.

## New Columns on `profiles`
- `rider_age` (integer, nullable) — rider's age
- `rider_family_status` (text, nullable) — family status description (e.g. "May asawa at 2 anak")
- `rider_residence_address` (text, nullable) — full home address of the rider
- `rider_valid_id_url` (text, nullable) — URL to uploaded valid ID image (stored in profile-images bucket)
- `rider_plate_number` (text, nullable) — motorcycle plate number
- `rider_motor_model` (text, nullable) — motorcycle make and model

## Security
- No new tables created. Existing RLS policies on `profiles` already allow users to read and update their own row.
- These columns are covered by the existing `update_own_profiles` policy since they are on the same table.
- No additional policies needed — the existing owner-scoped UPDATE policy already governs all columns on `profiles`.

## Notes
1. All columns are nullable so existing riders are not forced to fill everything at once.
2. The frontend will show which fields are still missing and encourage completion.
3. A "Verified" badge will appear when all rider verification fields are filled.
*/

-- Add rider verification columns to profiles table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_age'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_age integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_family_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_family_status text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_residence_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_residence_address text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_valid_id_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_valid_id_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_plate_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_plate_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rider_motor_model'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rider_motor_model text;
  END IF;
END $$;
