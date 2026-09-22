/*
# Fix wrong Davao store coordinates and populate missing ones

1. Problem:
   - The original store coordinates migration (20260907152337) seeded WRONG GPS
     coordinates for Davao City public markets. For example, Mintal Public Market
     was seeded as (7.1617, 125.4120) but the verified correct coordinate is
     (7.0925, 125.5025) — a difference of ~15km, which causes hugely inflated
     delivery fees.
   - Some stores (e.g. "Gulayan ni John" at Mintal Public Market) have NULL
     latitude/longitude because they were created after the migration ran.
     The system falls back to PALENGKE_COORDS lookup, but having explicit
     coordinates in the database is more reliable.

2. Changes:
   - UPDATE stores SET latitude/longitude to the verified correct values from
     PALENGKE_COORDS for all known Davao public markets, overwriting both
     wrong seeded values and populating NULL values.
   - Also populate coordinates for any store with a known palengke_name that
     currently has NULL latitude/longitude.

3. Security:
   - No RLS policy changes. Only data updates.

4. Notes:
   - Coordinates are sourced from the verified PALENGKE_COORDS lookup in
     src/lib/deliveryFee.ts, which was validated via OpenStreetMap Nominatim.
*/

-- Fix wrong Davao City public market coordinates (overwrite wrong seeded values)
UPDATE stores SET latitude = 7.0925, longitude = 125.5025 WHERE palengke_name = 'Mintal Public Market';
UPDATE stores SET latitude = 7.0561, longitude = 125.5773 WHERE palengke_name = 'Matina Public Market';
UPDATE stores SET latitude = 7.0818, longitude = 125.6233 WHERE palengke_name = 'Agdao Public Market';
UPDATE stores SET latitude = 7.0760, longitude = 125.6050 WHERE palengke_name = 'Bankerohan Public Market';
UPDATE stores SET latitude = 7.1122, longitude = 125.6234 WHERE palengke_name = 'Buhangin Public Market';
UPDATE stores SET latitude = 7.2362, longitude = 125.6397 WHERE palengke_name = 'Bunawan Public Market';
UPDATE stores SET latitude = 7.1909, longitude = 125.4545 WHERE palengke_name = 'Calinan Public Market';
UPDATE stores SET latitude = 7.0183, longitude = 125.4960 WHERE palengke_name = 'Toril Public Market';
UPDATE stores SET latitude = 7.0820, longitude = 125.6050 WHERE palengke_name = 'Cabaguio Public Market';
UPDATE stores SET latitude = 7.0980, longitude = 125.6300 WHERE palengke_name = 'Lanang Public Market';

-- Populate coordinates for ALL stores with known palengke names but NULL lat/lng
-- This covers stores created after the original migration ran
UPDATE stores SET latitude = 14.6564, longitude = 121.0025 WHERE palengke_name = 'Balintawak Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6954, longitude = 121.0870 WHERE palengke_name = 'Commonwealth Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6193, longitude = 121.0524 WHERE palengke_name = 'Farmers Market (Cubao)' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6680, longitude = 121.0150 WHERE palengke_name = 'Muñoz Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6990, longitude = 121.0330 WHERE palengke_name = 'Novaliches Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6759, longitude = 121.0433 WHERE palengke_name = 'Tandang Sora Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6020, longitude = 120.9690 WHERE palengke_name = 'Divisoria Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6100, longitude = 120.9800 WHERE palengke_name = 'Quintuple Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6179, longitude = 120.9698 WHERE palengke_name = 'Pritil Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5819, longitude = 121.0120 WHERE palengke_name = 'Santa Ana Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5990, longitude = 120.9760 WHERE palengke_name = 'Dagupan-Binondo Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5660, longitude = 121.0459 WHERE palengke_name = 'Guadalupe Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5652, longitude = 121.0336 WHERE palengke_name = 'Poblacion Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5432, longitude = 121.0109 WHERE palengke_name = 'Bangkal Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5578, longitude = 121.0838 WHERE palengke_name = 'Pasig Palengke' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5570, longitude = 121.0830 WHERE palengke_name = 'Kapasigan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5300, longitude = 121.0900 WHERE palengke_name = 'Pinagbuhatan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.4882, longitude = 121.0609 WHERE palengke_name = 'Taguig Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.4880, longitude = 121.0600 WHERE palengke_name = 'Lower Bicutan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.5200, longitude = 121.0500 WHERE palengke_name = 'Tipas Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.2920, longitude = 123.8978 WHERE palengke_name = 'Carbon Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.2896, longitude = 123.8918 WHERE palengke_name = 'Pasil Fish Port & Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.2950, longitude = 123.8800 WHERE palengke_name = 'Mambaling Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.2955, longitude = 123.8911 WHERE palengke_name = 'Taboan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.7094, longitude = 122.5677 WHERE palengke_name = 'La Paz Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.7219, longitude = 122.5549 WHERE palengke_name = 'Jaro Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 10.7202, longitude = 122.5621 WHERE palengke_name = 'Central Market (Super)' AND latitude IS NULL;
UPDATE stores SET latitude = 10.7163, longitude = 122.5365 WHERE palengke_name = 'Mandurriao Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 8.4774, longitude = 124.6515 WHERE palengke_name = 'Cogon Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 8.4792, longitude = 124.6367 WHERE palengke_name = 'Carmen Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 8.5112, longitude = 124.6236 WHERE palengke_name = 'Bulua Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 8.4900, longitude = 124.6700 WHERE palengke_name = 'Macabalan Fish Port' AND latitude IS NULL;
UPDATE stores SET latitude = 6.9100, longitude = 122.0700 WHERE palengke_name = 'Barasta Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 6.9400, longitude = 122.0600 WHERE palengke_name = 'Putik Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 6.9200, longitude = 122.0800 WHERE palengke_name = 'Veterans Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 6.1164, longitude = 125.1716 WHERE palengke_name = 'Gensan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 6.0800, longitude = 125.1600 WHERE palengke_name = 'Labangal Fish Port & Market' AND latitude IS NULL;
UPDATE stores SET latitude = 6.1300, longitude = 125.1800 WHERE palengke_name = 'Fatima Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 16.4159, longitude = 120.5950 WHERE palengke_name = 'Baguio City Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 16.4165, longitude = 120.5954 WHERE palengke_name = 'Hangar Market' AND latitude IS NULL;
UPDATE stores SET latitude = 16.4152, longitude = 120.5947 WHERE palengke_name = 'Hilltop Market' AND latitude IS NULL;
UPDATE stores SET latitude = 13.6210, longitude = 123.1837 WHERE palengke_name = 'Naga City People''s Mall' AND latitude IS NULL;
UPDATE stores SET latitude = 13.6230, longitude = 123.1850 WHERE palengke_name = 'Naga Central Market' AND latitude IS NULL;
UPDATE stores SET latitude = 13.1469, longitude = 123.7504 WHERE palengke_name = 'Legazpi City Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 13.1400, longitude = 123.7400 WHERE palengke_name = 'Albay Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6631, longitude = 120.9568 WHERE palengke_name = 'Malabon Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 14.6430, longitude = 120.9511 WHERE palengke_name = 'Navotas Fish Port Complex' AND latitude IS NULL;
