/*
# Add latitude/longitude columns to stores table

1. Changes to existing tables:
   - `stores`: Added `latitude` (numeric, nullable) and `longitude` (numeric, nullable) columns
     to store the exact GPS coordinates of each store/market location.
   - These columns enable Haversine distance calculation for accurate delivery fee computation.

2. Security:
   - No RLS policy changes needed — existing store policies already cover the new columns
     since they are part of the stores table and inherit the same access rules.

3. Notes:
   - Columns are nullable so existing stores are not affected.
   - Known palengke (public market) coordinates will be populated via UPDATE statements
     using a coordinate lookup for Davao City markets.
*/

-- Add latitude and longitude columns to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

-- Seed known Davao City public market coordinates
UPDATE stores SET latitude = 7.1617, longitude = 125.4120 WHERE palengke_name = 'Mintal Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0790, longitude = 125.4560 WHERE palengke_name = 'Matina Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0820, longitude = 125.6330 WHERE palengke_name = 'Agdao Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0760, longitude = 125.6050 WHERE palengke_name = 'Bankerohan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0980, longitude = 125.6300 WHERE palengke_name = 'Buhangin Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0400, longitude = 125.6700 WHERE palengke_name = 'Bunawan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.1750, longitude = 125.3450 WHERE palengke_name = 'Calinan Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0000, longitude = 125.4900 WHERE palengke_name = 'Toril Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0900, longitude = 125.5800 WHERE palengke_name = 'Cabaguio Public Market' AND latitude IS NULL;
UPDATE stores SET latitude = 7.0900, longitude = 125.6400 WHERE palengke_name = 'Lanang Public Market' AND latitude IS NULL;