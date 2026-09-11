/*
# Add complete_address column to profiles

## Purpose
Buyers need to save their complete residence address (house number, street,
subdivision, etc.) so that:
1. It persists across sessions in their profile
2. It pre-fills automatically at checkout
3. The rider can see the full address on the delivery screen

## Changes
- Adds `complete_address` (text, nullable) to the `profiles` table
- No RLS policy changes needed — existing UPDATE policies already cover
  the profiles table, and the column inherits the same row-level security

## No data loss
- New nullable column, no existing data affected
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'complete_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN complete_address text;
  END IF;
END $$;
