/*
# Add palengke_name column to stores table

## Overview
Adds an optional "palengke_name" column to the stores table so sellers can indicate
which physical wet market (palengke) they have a stall (pwesto) at. This is purely
optional — sellers without a physical palengke stall can still sell on the platform.

## Changes
1. New column on `stores`:
   - `palengke_name` (text, nullable) — the name of the physical palengke where the
     seller has their pwesto/stall. NULL means the seller is online-only.

2. New index on `stores(palengke_name)` for faster palengke-based searches.

## Security
- No RLS policy changes needed — the existing stores_select_all policy already
  allows public reads of all stores, and stores_update_own already allows owners
  to update any column on their own store row.
*/

ALTER TABLE stores ADD COLUMN IF NOT EXISTS palengke_name text;

CREATE INDEX IF NOT EXISTS idx_stores_palengke_name ON stores(palengke_name);
