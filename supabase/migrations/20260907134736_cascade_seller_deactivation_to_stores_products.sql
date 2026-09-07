/*
# Cascade seller deactivation/activation to stores and products

## Problem
When an admin deactivates a seller (setting `profiles.is_active = false`),
the seller's stores and products remain visible to buyers because the
buyer homepage filters on `stores.is_open` and `products.is_available`,
neither of which change when `profiles.is_active` is toggled.

## Solution
Add a database trigger on `profiles` that fires AFTER UPDATE.
When a seller's `is_active` changes:
  - Deactivated (is_active = false): set all their stores to `is_open = false`
    and all their products to `is_available = false`.
  - Reactivated (is_active = true): restore stores to `is_open = true`
    and products to `is_available = true` (only those that were previously
    available — we track this via a `was_available` column on products
    and `was_open` column on stores).

## New Columns
- `stores.was_open` (boolean, nullable): remembers the previous `is_open`
  value before the store was force-closed by deactivation, so reactivation
  can restore it.
- `products.was_available` (boolean, nullable): same for product availability.

## How it works
1. Seller is deactivated → trigger closes all their stores and marks products
   unavailable, saving the prior state in `was_open`/`was_available`.
2. Seller is reactivated → trigger restores `is_open`/`is_available` from
   the saved `was_open`/`was_available` values, then clears them.

## Security
No RLS changes — this is a trigger function running with SECURITY DEFINER
so it can update stores/products regardless of the caller's role.
The trigger only acts on role = 'seller' profiles.
*/

-- Add tracking columns to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS was_open boolean;

-- Add tracking columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS was_available boolean;

-- Trigger function: cascade seller activation/deactivation
CREATE OR REPLACE FUNCTION cascade_seller_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when is_active changed AND the user is a seller
  IF (NEW.role = 'seller' AND OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    IF NEW.is_active = false THEN
      -- Deactivating: close stores, save prior is_open, mark products unavailable
      UPDATE stores
        SET was_open = is_open, is_open = false
        WHERE seller_id = NEW.id AND is_open = true;

      UPDATE products
        SET was_available = is_available, is_available = false
        WHERE store_id IN (SELECT id FROM stores WHERE seller_id = NEW.id)
          AND is_available = true;

    ELSIF NEW.is_active = true THEN
      -- Reactivating: restore prior state from was_open / was_available
      UPDATE stores
        SET is_open = COALESCE(was_open, true), was_open = NULL
        WHERE seller_id = NEW.id;

      UPDATE products
        SET is_available = COALESCE(was_available, true), was_available = NULL
        WHERE store_id IN (SELECT id FROM stores WHERE seller_id = NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_cascade_seller_activation ON profiles;
CREATE TRIGGER trigger_cascade_seller_activation
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION cascade_seller_activation();
