-- Add rejection_reason column to video_credit_purchases
ALTER TABLE video_credit_purchases ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update reject function to accept a reason parameter
CREATE OR REPLACE FUNCTION reject_video_credit_purchase(purchase_id uuid, p_rejection_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Hindi awtorisado. Admin lang ang pwedeng mag-reject.';
  END IF;

  UPDATE video_credit_purchases
  SET status = 'rejected',
      rejection_reason = p_rejection_reason,
      updated_at = now()
  WHERE id = purchase_id AND status = 'pending';

  RETURN FOUND;
END;
$$;