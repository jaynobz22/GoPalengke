-- ============= ADD MISSING CATEGORIES FOR PALENGKE PRODUCTS =============
-- Based on actual palengke goods: noodles/pansit, eggs, frozen goods, bakery, beverages, snacks, household items, and a general catch-all

INSERT INTO categories (name, name_fil, slug, icon, sort_order) VALUES
  ('Noodles & Pasta', 'Pansit at Pasta', 'noodles-pasta', 'Soup', 9),
  ('Eggs', 'Itlog', 'eggs', 'Egg', 10),
  ('Frozen Goods', 'Frozen Products', 'frozen-goods', 'Snowflake', 11),
  ('Bakery', 'Tinapay', 'bakery', 'Cookie', 12),
  ('Beverages', 'Inumin', 'beverages', 'Coffee', 13),
  ('Snacks & Sweets', 'Meryenda at Minatamis', 'snacks-sweets', 'Cookie', 14),
  ('Household Items', 'Gamit sa Bahay', 'household-items', 'SprayCan', 15),
  ('General Merchandise', 'Iba Pang Paninda', 'general-merchandise', 'Package', 16)
ON CONFLICT (slug) DO NOTHING;
