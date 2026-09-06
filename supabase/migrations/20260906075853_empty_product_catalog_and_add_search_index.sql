/*
# Empty Product Catalog + Add Product Search Index

## Overview
Empties the pre-built product_catalog table (the seed data had incorrect photos)
and adds an index on products.name to support fast image-reuse searches when
sellers add new products.

## Changes
1. DELETE all rows from product_catalog — removes the 20 seed rows that had
   wrong photos. Uses DELETE (not TRUNCATE) because products.catalog_id has a
   foreign key referencing this table. Existing products with catalog_id=NULL
   (the default) are unaffected. Any product with a non-null catalog_id will
   have it set to NULL via ON DELETE SET NULL.
2. CREATE INDEX idx_products_name — speeds up case-insensitive name searches
   when a seller looks for existing product photos to reuse.

## Security
- No policy changes.
- product_catalog retains its existing public-read RLS policy.
*/

-- Remove all seed rows from product_catalog (wrong photos)
DELETE FROM product_catalog;

-- Add index for fast product name search (image reuse feature)
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
