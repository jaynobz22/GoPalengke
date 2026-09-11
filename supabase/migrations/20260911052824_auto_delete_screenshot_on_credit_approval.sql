/*
# Auto-delete payment screenshots on approval/rejection

## Purpose
When an admin approves or rejects a video credit top-up request, the uploaded
payment screenshot is immediately and permanently deleted from the
`payment-screenshots` storage bucket. Only the text reference number and
transaction status remain in the database for audit purposes.

## Changes
1. `approve_video_credit_purchase` — now captures the screenshot_url before
   marking approved, deletes the file from storage.objects, and sets
   screenshot_url to NULL on the purchase row.
2. `reject_video_credit_purchase` — same deletion + null-out behavior on reject.
3. Both functions extract the storage object path from the public URL and issue
   a DELETE against storage.objects.

## Security
- Both functions remain SECURITY DEFINER, admin-only (role = 'admin' check).
- No new policies added. No schema columns added or removed.
- screenshot_url is nullable, so setting it to NULL is safe.
*/

-- Updated approve function: delete screenshot from storage, null out the column
CREATE OR REPLACE FUNCTION approve_video_credit_purchase(purchase_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  purchase_record record;
  screenshot_path text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Hindi awtorisado. Admin lang ang pwedeng mag-approve.';
  END IF;

  SELECT * INTO purchase_record
  FROM video_credit_purchases
  WHERE id = purchase_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Add credits to the user's balance
  UPDATE profiles
  SET video_credits = video_credits + purchase_record.credits
  WHERE id = purchase_record.user_id;

  -- Extract the storage object path from the public URL and delete the file
  IF purchase_record.screenshot_url IS NOT NULL THEN
    screenshot_path := split_part(purchase_record.screenshot_url, '/payment-screenshots/', 2);
    IF screenshot_path != '' THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'payment-screenshots' AND name = screenshot_path;
    END IF;
  END IF;

  -- Mark purchase as approved and clear the screenshot URL
  UPDATE video_credit_purchases
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      screenshot_url = NULL,
      updated_at = now()
  WHERE id = purchase_id;

  RETURN true;
END;
$$;

-- Updated reject function: delete screenshot from storage, null out the column
CREATE OR REPLACE FUNCTION reject_video_credit_purchase(purchase_id uuid, p_rejection_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  purchase_record record;
  screenshot_path text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Hindi awtorisado. Admin lang ang pwedeng mag-reject.';
  END IF;

  SELECT * INTO purchase_record
  FROM video_credit_purchases
  WHERE id = purchase_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Extract the storage object path from the public URL and delete the file
  IF purchase_record.screenshot_url IS NOT NULL THEN
    screenshot_path := split_part(purchase_record.screenshot_url, '/payment-screenshots/', 2);
    IF screenshot_path != '' THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'payment-screenshots' AND name = screenshot_path;
    END IF;
  END IF;

  -- Mark purchase as rejected and clear the screenshot URL
  UPDATE video_credit_purchases
  SET status = 'rejected',
      rejection_reason = p_rejection_reason,
      screenshot_url = NULL,
      updated_at = now()
  WHERE id = purchase_id AND status = 'pending';

  RETURN FOUND;
END;
$$;
