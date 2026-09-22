INSERT INTO categories (slug, name, name_fil, sort_order)
VALUES
  ('ulam', 'Cooked Dishes (Ulam)', 'Mga Ulam', 18),
  ('kakanin', 'Kakanin & Native Sweets', 'Kakanin', 19)
ON CONFLICT (slug) DO NOTHING;
