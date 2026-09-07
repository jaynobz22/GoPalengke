/*
# Add seller_type and farm_type columns to stores

## Overview
Sellers can either have a physical stall (pwesto) at a palengke, OR sell from home
if they have a farm, fishpond, or livestock. This migration adds two new columns
to the stores table to capture this distinction.

## Changes
1. New columns on `stores`:
   - `seller_type` (text, nullable) — 'palengke' if the seller has a stall at a
     physical wet market, 'farm' if they sell from home with a farm/fishpond/livestock.
     NULL means the seller hasn't specified (backwards compatible with existing stores).
   - `farm_type` (text, nullable) — when seller_type is 'farm', specifies what kind
     of home source they have: 'vegetable_farm', 'fishpond', 'poultry', 'livestock',
     or 'mixed'. NULL when seller_type is 'palengke' or not specified.

## Security
- No RLS policy changes needed — existing stores policies already allow owners
  to insert/update any column on their own store row, and public reads remain open.

## Notes
1. Both columns are nullable so existing stores are unaffected.
2. The frontend will set seller_type='palengke' when a palengke is selected,
   and seller_type='farm' with a farm_type when the seller chooses the farm option.
*/

ALTER TABLE stores ADD COLUMN IF NOT EXISTS seller_type text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS farm_type text;
