/*
# Product Catalog Library + Storage Buckets + Product Link

## Overview
Creates a pre-built product catalog library that sellers can browse and toggle on
for their store, instead of uploading their own photos. Also adds storage buckets
for both catalog images and seller-uploaded product images.

## New Tables
1. `product_catalog` - Master library of all palengke products with 3 image variations each
   - `id` (uuid, PK)
   - `name` (text) - Product name e.g. "Bangus"
   - `name_fil` (text) - Filipino name
   - `category` (text) - Category slug: isda, karne, gulay, panakot
   - `default_unit` (text) - Default unit e.g. "kilo", "piece", "bundle"
   - `image_url_1` (text) - First image variation
   - `image_url_2` (text) - Second image variation
   - `image_url_3` (text) - Third image variation
   - `sort_order` (int) - Display order
   - `created_at` (timestamptz)

## Modified Tables
1. `products` - Added two new columns:
   - `catalog_id` (uuid, nullable) - FK to product_catalog, links a store product to a catalog entry
   - `selected_image_index` (int, default 1) - Which of the 3 catalog images the seller chose (1, 2, or 3)

## Storage
1. `product-catalog` bucket - Public bucket for pre-built catalog images (admin-managed)
2. `product-images` bucket - Public bucket for seller-uploaded product photos

## Security
- `product_catalog`: Public read (anon + authenticated), no writes from frontend
- `products` table: existing RLS policies remain unchanged; new columns inherit existing access
- Storage buckets: public read for both; authenticated can upload to `product-images` only
*/

-- ============= PRODUCT CATALOG TABLE =============
CREATE TABLE IF NOT EXISTS product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fil text NOT NULL,
  category text NOT NULL,
  default_unit text NOT NULL DEFAULT 'kilo',
  image_url_1 text,
  image_url_2 text,
  image_url_3 text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- Public can read the catalog
DROP POLICY IF EXISTS "catalog_select_all" ON product_catalog;
CREATE POLICY "catalog_select_all" ON product_catalog FOR SELECT
  TO anon, authenticated USING (true);

-- No insert/update/delete policies = no frontend writes allowed

-- Index for searching by name and filtering by category
CREATE INDEX IF NOT EXISTS idx_catalog_name ON product_catalog(name);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON product_catalog(category);

-- ============= ADD COLUMNS TO PRODUCTS =============
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES product_catalog(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selected_image_index int DEFAULT 1;

-- ============= STORAGE BUCKETS =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-catalog', 'product-catalog', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images bucket (seller uploads)
-- Public read: anyone can view product images
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Authenticated can insert into product-images
DROP POLICY IF EXISTS "product_images_auth_insert" ON storage.objects;
CREATE POLICY "product_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated can update their own objects in product-images
DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
CREATE POLICY "product_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated can delete their own objects in product-images
DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;
CREATE POLICY "product_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

-- Storage policies for product-catalog bucket (public read only, no frontend writes)
DROP POLICY IF EXISTS "product_catalog_public_read" ON storage.objects;
CREATE POLICY "product_catalog_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-catalog');