-- Video Credits System
-- Implements a credit-based system for video calling. Users get 3 free credits
-- to start. Each credit = 1 minute of video call. Credits are deducted every 60
-- seconds during an active call. Users can buy more credits via manual payment
-- (GCash/Maya/bank transfer) with admin approval.

-- 1. Add video_credits column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'video_credits'
  ) THEN
    ALTER TABLE profiles ADD COLUMN video_credits integer NOT NULL DEFAULT 3;
  END IF;
END $$;

-- 2. Create video_credit_purchases table
CREATE TABLE IF NOT EXISTS video_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  reference_number text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE video_credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
DROP POLICY IF EXISTS "select_own_video_credits" ON video_credit_purchases;
CREATE POLICY "select_own_video_credits"
ON video_credit_purchases FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own purchases
DROP POLICY IF EXISTS "insert_own_video_credits" ON video_credit_purchases;
CREATE POLICY "insert_own_video_credits"
ON video_credit_purchases FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can read all purchases
DROP POLICY IF EXISTS "admin_select_video_credits" ON video_credit_purchases;
CREATE POLICY "admin_select_video_credits"
ON video_credit_purchases FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admins can update purchase status (approve/reject)
DROP POLICY IF EXISTS "admin_update_video_credits" ON video_credit_purchases;
CREATE POLICY "admin_update_video_credits"
ON video_credit_purchases FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_video_credit_purchases_user_id ON video_credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_video_credit_purchases_status ON video_credit_purchases(status);

-- 3. SECURITY DEFINER: deduct_video_credit
-- Atomically decrements the caller's video_credits by 1 and returns the new balance.
CREATE OR REPLACE FUNCTION deduct_video_credit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET video_credits = GREATEST(video_credits - 1, 0)
  WHERE id = auth.uid()
  RETURNING video_credits INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN -1;
  END IF;

  RETURN new_balance;
END;
$$;

-- 4. SECURITY DEFINER: approve_video_credit_purchase
-- Admin approves a pending purchase: adds credits to user and marks approved.
CREATE OR REPLACE FUNCTION approve_video_credit_purchase(purchase_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  purchase_record record;
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

  -- Mark purchase as approved
  UPDATE video_credit_purchases
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = purchase_id;

  RETURN true;
END;
$$;

-- 5. SECURITY DEFINER: reject_video_credit_purchase
-- Admin rejects a pending purchase.
CREATE OR REPLACE FUNCTION reject_video_credit_purchase(purchase_id uuid)
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
      updated_at = now()
  WHERE id = purchase_id AND status = 'pending';

  RETURN FOUND;
END;
$$;

-- 6. Create payment-screenshots storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-screenshots
DROP POLICY IF EXISTS "read_payment_screenshots" ON storage.objects;
CREATE POLICY "read_payment_screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "insert_payment_screenshots" ON storage.objects;
CREATE POLICY "insert_payment_screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-screenshots');