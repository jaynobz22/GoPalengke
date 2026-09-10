/*
# Add Livestock category and delivery_method to products

1. New Data
- Adds a "Livestock" category (slug: 'livestock', name_fil: 'Buhay na Hayop') to the categories table.
- sort_order = 17, placed after all existing categories.
- Icon column set to 'Bird' (lucide-react name) for reference.

2. Schema Changes
- Adds `delivery_method` column to `products` table (text, nullable).
  - NULL means standard delivery via rider (default behavior, backwards-compatible).
  - 'pickup' means buyer picks up at store location.
  - 'meetup' means buyer and seller agree to meet at a designated location.
- Adds `delivery_method` column to `orders` table (text, nullable).
  - Same values as above; copied from the product/store at checkout time.
- Adds `livestock_permit_url` column to `stores` table (text, nullable).
  - Stores a URL to the seller's transport permit for livestock.
  - Required when selling livestock that needs to travel long distances.

3. Security
- No new tables, so no new RLS policies needed.
- Existing policies on products, orders, and stores remain unchanged.
- The new columns are nullable and backwards-compatible.

4. Important Notes
- The delivery_method column allows the app to skip rider assignment for livestock orders.
- Livestock orders use pickup or meetup instead of rider delivery.
- The livestock_permit_url on stores is informational — sellers attest they have proper permits.
- All existing products and orders default to NULL delivery_method (rider delivery), preserving current behavior.
*/

-- Add Livestock category
INSERT INTO categories (name, name_fil, slug, icon, sort_order)
VALUES ('Livestock', 'Buhay na Hayop', 'livestock', 'Bird', 17)
ON CONFLICT (slug) DO NOTHING;

-- Add delivery_method to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_method text;

-- Add delivery_method to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method text;

-- Add livestock_permit_url to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS livestock_permit_url text;
