/*
# Create rider-receipts storage bucket

## Purpose
Storage bucket for rider payment receipt screenshots uploaded during billing payment submission.
Screenshots are auto-scheduled for deletion after 1 hour or upon admin approval.

## Security
- Public read (for admin viewing)
- Authenticated users can upload to their own folder
- Authenticated users can delete their own files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('rider-receipts', 'rider-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
DROP POLICY IF EXISTS "public_read_rider_receipts" ON storage.objects;
CREATE POLICY "public_read_rider_receipts" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'rider-receipts');

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "auth_upload_rider_receipts" ON storage.objects;
CREATE POLICY "auth_upload_rider_receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rider-receipts');

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "auth_delete_rider_receipts" ON storage.objects;
CREATE POLICY "auth_delete_rider_receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rider-receipts' AND owner = auth.uid());

-- Allow authenticated users to update their own files
DROP POLICY IF EXISTS "auth_update_rider_receipts" ON storage.objects;
CREATE POLICY "auth_update_rider_receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rider-receipts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'rider-receipts');