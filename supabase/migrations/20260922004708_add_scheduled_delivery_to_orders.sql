/*
# Add scheduled delivery option to orders

1. New Columns
- `orders.scheduled_delivery_at` (timestamptz, nullable) — when the buyer wants the order delivered.
  When NULL, the order is for immediate delivery (current behavior). When set, the order is a
  pre-booked / advance order and the seller has until this time to prepare.

2. Index
- Added an index on `scheduled_delivery_at` so sellers and riders can efficiently find
  upcoming scheduled orders.

3. Security
- No new tables. No policy changes needed — the existing order RLS policies already cover
  the new column since it's on the same `orders` table. Buyers can set it on insert (their
  own order), sellers can read it (their store's order), riders can read it (assigned order).
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_delivery_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_delivery_at
  ON orders (scheduled_delivery_at)
  WHERE scheduled_delivery_at IS NOT NULL;
