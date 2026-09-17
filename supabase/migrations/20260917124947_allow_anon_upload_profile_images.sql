-- Allow anon (unauthenticated) users to upload to profile-images bucket.
-- This is needed for the affiliate registration flow, where a new affiliate
-- uploads their payout QR code before they have any Supabase auth session.
-- The affiliate program uses its own lightweight auth (password_hash column),
-- not Supabase Auth, so the client operates as the anon role during registration.

DROP POLICY IF EXISTS "profile_images_anon_insert" ON storage.objects;
CREATE POLICY "profile_images_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'profile-images');
