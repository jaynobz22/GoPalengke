/*
# Add per-party hide columns to orders

## Purpose
Buyers, sellers, and riders can each remove finished (delivered/cancelled)
orders from their own view. This is a soft-delete: the order row is NOT
 deleted — only hidden from the party who chose to hide it. The other
parties still see the order in their own views.

## Changes
1. Adds three nullable timestamp columns to `orders`:
   - `hidden_by_buyer_at` — set when the buyer hides the order.
   - `hidden_by_seller_at` — set when the seller hides the order.
   - `hidden_by_rider_at` — set when the rider hides the order.
2. No new tables.
3. No RLS policy changes needed — the existing orders UPDATE policies
   already allow each party to update their own orders. Setting a
   hide timestamp is an update to the order row by the party who
   legitimately has access to it.

## Security
- No new policies. Existing order RLS covers these columns.
- Only the party that owns the relationship (buyer/seller via store /
  rider via rider_id) can update the order, so only they can set their
  own hide timestamp.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hidden_by_buyer_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by_seller_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by_rider_at timestamptz;
