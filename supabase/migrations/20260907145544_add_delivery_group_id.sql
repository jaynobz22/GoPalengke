/*
# Multi-Store Delivery Grouping

## Overview
Adds `delivery_group_id` to the orders table so that orders created in the same
checkout session (multiple stores) are linked together. This enables:
1. Buyer-side: combined QR payment screen showing all stores' QR codes
2. Rider-side: batch delivery view with multiple pickup points

## Changes
- `orders.delivery_group_id` (uuid, nullable) — shared across orders from one checkout
- Index on delivery_group_id for efficient grouping queries
- Existing orders get NULL (no group) — they work as before, standalone

## Notes
1. Orders with NULL delivery_group_id behave exactly as before (standalone)
2. Orders with the same delivery_group_id are a "batch" — same buyer, same delivery address
3. Each order still has its own store_id, rider_id, status, payment_status
4. Riders assigned to one order in a group should be assigned to all in the group
*/

ALTER TABLE orders ADD COLUMN delivery_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_group_id ON orders(delivery_group_id)
  WHERE delivery_group_id IS NOT NULL;
