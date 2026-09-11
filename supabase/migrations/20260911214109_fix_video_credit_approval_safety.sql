-- 1. Drop duplicate reject_video_credit_purchase functions to eliminate ambiguity
--    (there are currently two overloads — one without and one with rejection_reason)
DROP FUNCTION IF EXISTS reject_video_credit_purchase(uuid);
DROP FUNCTION IF EXISTS reject_video_credit_purchase(uuid, text);

-- 2. Recreate approve function with safe screenshot deletion
--    The DELETE FROM storage.objects is wrapped in BEGIN/EXCEPTION so a storage
--    failure can never block the credit approval.
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

  -- Safely attempt screenshot deletion — never block approval on storage failure
  IF purchase_record.screenshot_url IS NOT NULL THEN
    screenshot_path := split_part(purchase_record.screenshot_url, '/payment-screenshots/', 2);
    IF screenshot_path != '' THEN
      BEGIN
        DELETE FROM storage.objects
        WHERE bucket_id = 'payment-screenshots' AND name = screenshot_path;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- ignore storage errors; approval must succeed regardless
      END;
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

-- 3. Recreate reject function (single version, with rejection_reason)
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

  -- Safely attempt screenshot deletion
  IF purchase_record.screenshot_url IS NOT NULL THEN
    screenshot_path := split_part(purchase_record.screenshot_url, '/payment-screenshots/', 2);
    IF screenshot_path != '' THEN
      BEGIN
        DELETE FROM storage.objects
        WHERE bucket_id = 'payment-screenshots' AND name = screenshot_path;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
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
