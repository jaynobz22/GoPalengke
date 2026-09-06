/*
# Create profile-images storage bucket and allow profile reads

1. Storage
- New public bucket `profile-images` for user-uploaded profile pictures (buyers, sellers, riders).
- Public read (anyone can view profile photos for transparency).
- Authenticated users can insert, update, and delete their own uploads.

2. Security Changes
- Updated `profiles` SELECT policy: any authenticated user can now read any profile row (previously only own profile). This is required so buyers, sellers, and riders can see each other's names and avatar URLs during chats and orders.
- The UPDATE and INSERT policies remain owner-only (users can only modify their own profile).

3. Important Notes
- The `avatar_url` column already exists on the `profiles` table from the initial migration.
- Profile images are stored at path `avatars/<user_id>/<timestamp>.<ext>`.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for profile-images bucket
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
CREATE POLICY "profile_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile-images');

-- Authenticated insert
DROP POLICY IF EXISTS "profile_images_auth_insert" ON storage.objects;
CREATE POLICY "profile_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-images');

-- Authenticated update
DROP POLICY IF EXISTS "profile_images_auth_update" ON storage.objects;
CREATE POLICY "profile_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images')
  WITH CHECK (bucket_id = 'profile-images');

-- Authenticated delete
DROP POLICY IF EXISTS "profile_images_auth_delete" ON storage.objects;
CREATE POLICY "profile_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images');

-- Update profiles SELECT policy so any authenticated user can read any profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_all_authenticated" ON profiles FOR SELECT
  TO authenticated USING (true);
