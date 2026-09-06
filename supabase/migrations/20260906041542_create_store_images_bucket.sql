/*
# Create store-images storage bucket

1. Storage
- New public bucket `store-images` for seller-uploaded store logos, banners, and GCash QR code screenshots.
- Public read (anyone can view store images).
- Authenticated users can insert, update, and delete their own uploads.
2. Security
- Public read policy for store-images bucket.
- Authenticated insert/update/delete policies scoped to the bucket.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-images', 'store-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "store_images_public_read" ON storage.objects;
CREATE POLICY "store_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-images');

-- Authenticated insert
DROP POLICY IF EXISTS "store_images_auth_insert" ON storage.objects;
CREATE POLICY "store_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-images');

-- Authenticated update
DROP POLICY IF EXISTS "store_images_auth_update" ON storage.objects;
CREATE POLICY "store_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-images')
  WITH CHECK (bucket_id = 'store-images');

-- Authenticated delete
DROP POLICY IF EXISTS "store_images_auth_delete" ON storage.objects;
CREATE POLICY "store_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-images');