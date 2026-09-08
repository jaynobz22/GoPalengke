/*
# Add Store Verification System

## Purpose
Changes the seller onboarding flow: sellers are now auto-approved on signup
(can access the app, create stores, customize profiles) but their stores start
as "unverified" — invisible to buyers until an admin reviews and verifies them.

## Changes

1. New Column
   - `stores.is_verified` (boolean, NOT NULL, default false)
   - Controls whether a store and its products are visible to buyers on the
     homepage, buyer dashboard, and landing page.

2. Data Migration
   - All existing stores are set to `is_verified = true` (grandfathered in).
   - All existing sellers (role = 'seller') are set to `is_approved = true`
     so they are not blocked by the app's approval gate.

3. Security
   - No RLS policy changes. The `is_verified` column is readable by all
     (anon + authenticated) since it's on the `stores` table which already has
     a permissive SELECT policy. Client-side queries will filter on
     `is_verified = true` for buyer-facing views; admin and the store owner
     can still read unverified stores.

## Important Notes
1. New sellers get `is_approved = true` from the frontend signUp function,
   so they pass the App.tsx approval gate immediately.
2. New stores default to `is_verified = false` — the seller can create and
   customize their store, but it won't appear to buyers until admin verifies.
3. Admin verifies a store by setting `is_verified = true` via the admin panel.
*/

-- Add is_verified column to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Grandfather all existing stores as verified
UPDATE stores SET is_verified = true WHERE is_verified = false;

-- Auto-approve all existing sellers so they're not blocked by the approval gate
UPDATE profiles SET is_approved = true WHERE role = 'seller';
