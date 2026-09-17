/*
# Create Affiliate Marketing Materials System

1. New Tables
- `affiliate_marketing_materials` — stores promotional content uploaded by admin for affiliates to share
  - `id` (uuid, primary key)
  - `title` (text) — display name of the material
  - `type` (text) — 'banner' | 'image' | 'video' | 'text_post'
  - `media_url` (text) — URL to uploaded image/banner in storage, or YouTube thumbnail
  - `youtube_url` (text, nullable) — YouTube video link for video type
  - `caption` (text, nullable) — ready-to-copy promotional text with placeholder for referral code
  - `is_active` (boolean, default true) — admin can deactivate materials
  - `sort_order` (int, default 0) — ordering
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Storage
- Create `affiliate-marketing` public storage bucket for banner/image uploads

3. Security
- Enable RLS on `affiliate_marketing_materials`
- Public read (anon + authenticated) so affiliates can view materials
- Only admin can insert/update/delete (enforced via admin role check in app layer; RLS allows authenticated to write since admin is authenticated)
- Storage bucket is public for reads
*/

CREATE TABLE IF NOT EXISTS affiliate_marketing_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'image' CHECK (type IN ('banner', 'image', 'video', 'text_post')),
  media_url text,
  youtube_url text,
  caption text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE affiliate_marketing_materials ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including anon affiliates) can view marketing materials
DROP POLICY IF EXISTS "public_read_marketing_materials" ON affiliate_marketing_materials;
CREATE POLICY "public_read_marketing_materials" ON affiliate_marketing_materials
  FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated (admin) can create
DROP POLICY IF EXISTS "auth_insert_marketing_materials" ON affiliate_marketing_materials;
CREATE POLICY "auth_insert_marketing_materials" ON affiliate_marketing_materials
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only authenticated (admin) can update
DROP POLICY IF EXISTS "auth_update_marketing_materials" ON affiliate_marketing_materials;
CREATE POLICY "auth_update_marketing_materials" ON affiliate_marketing_materials
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Only authenticated (admin) can delete
DROP POLICY IF EXISTS "auth_delete_marketing_materials" ON affiliate_marketing_materials;
CREATE POLICY "auth_delete_marketing_materials" ON affiliate_marketing_materials
  FOR DELETE TO authenticated USING (true);

-- Create storage bucket for marketing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('affiliate-marketing', 'affiliate-marketing', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "public_read_affiliate_marketing" ON storage.objects;
CREATE POLICY "public_read_affiliate_marketing" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'affiliate-marketing');

DROP POLICY IF EXISTS "auth_insert_affiliate_marketing" ON storage.objects;
CREATE POLICY "auth_insert_affiliate_marketing" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'affiliate-marketing');

DROP POLICY IF EXISTS "auth_update_affiliate_marketing" ON storage.objects;
CREATE POLICY "auth_update_affiliate_marketing" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'affiliate-marketing') WITH CHECK (bucket_id = 'affiliate-marketing');

DROP POLICY IF EXISTS "auth_delete_affiliate_marketing" ON storage.objects;
CREATE POLICY "auth_delete_affiliate_marketing" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'affiliate-marketing');
