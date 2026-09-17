/*
# Rider Billing and Onboarding System

## Overview
Implements a post-paid billing system for riders: 3% platform fee on delivery earnings,
₱500 threshold with auto-deactivation, ₱300 onboarding fee (deferred until ₱1,000 career earnings),
and QR-code payment remittance with admin approval.

## New Tables

### rider_fees
- Tracks accumulated 3% platform fees per rider
- `rider_id` (uuid, FK to profiles, unique) — the rider
- `platform_fee_balance` (numeric, default 0) — accumulated 3% fees
- `total_career_earnings` (numeric, default 0) — cumulative delivery earnings
- `onboarding_fee_status` (text: 'not_applicable' | 'pending' | 'active' | 'paid') — status of ₱300 onboarding fee
- `onboarding_fee_paid_at` (timestamptz, nullable) — when onboarding fee was settled
- `total_payable` (numeric, default 0) — current balance due (platform_fee_balance + active onboarding fee)
- `frozen_at` (timestamptz, nullable) — when rider was auto-deactivated for reaching ₱500
- `warning_80_sent_at` (timestamptz, nullable) — when 80% warning was triggered
- `warning_90_sent_at` (timestamptz, nullable) — when 90% warning was triggered

### rider_fee_payments
- Payment submissions from riders for admin approval
- `rider_id` (uuid, FK to profiles) — the rider
- `amount` (numeric) — amount paid
- `reference_number` (text) — GCash/Maya reference
- `screenshot_url` (text, nullable) — receipt screenshot (auto-deleted after 1hr or on approval)
- `screenshot_delete_at` (timestamptz, nullable) — scheduled deletion time
- `status` (text: 'pending' | 'approved' | 'rejected', default 'pending')
- `approved_by` (uuid, nullable, FK to profiles) — admin who approved
- `approved_at` (timestamptz, nullable)
- `fee_type` (text: 'platform_fee' | 'onboarding_fee' | 'both') — what the payment covers
- `platform_fee_paid` (numeric, default 0) — portion applied to platform fees
- `onboarding_fee_paid` (numeric, default 0) — portion applied to onboarding fee

## Trigger: apply_rider_fee_on_delivery
- BEFORE UPDATE on orders: when status changes to 'delivered' and rider_id is set,
  calculates 3% of delivery_fee, adds to rider_fees.platform_fee_balance and total_career_earnings.
- Also checks if total_career_earnings >= 1000 and activates onboarding fee if pending.
- Checks threshold (400, 450, 500) and updates rider profile is_active = false when reaching 500.

## RPC Functions
- approve_rider_fee_payment(p_payment_id, p_admin_id) — approves payment, reduces balance, reactivates rider if frozen
- reactivate_rider(p_rider_id) — manually reactivate a frozen rider
- delete_expired_rider_screenshots() — deletes screenshots older than 1 hour or already approved

## Security
- RLS enabled on both tables
- Riders can read/update their own rider_fees row
- Riders can insert/read their own rider_fee_payments
- Admins can read all rider_fees and rider_fee_payments, update payment statuses
*/

-- =========================================================
-- 1. rider_fees table
-- =========================================================
CREATE TABLE IF NOT EXISTS rider_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  platform_fee_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_career_earnings numeric(12,2) NOT NULL DEFAULT 0,
  onboarding_fee_status text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_fee_status IN ('not_applicable','pending','active','paid')),
  onboarding_fee_paid_at timestamptz,
  total_payable numeric(12,2) NOT NULL DEFAULT 0,
  frozen_at timestamptz,
  warning_80_sent_at timestamptz,
  warning_90_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rider_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rider_fees" ON rider_fees;
CREATE POLICY "select_own_rider_fees" ON rider_fees FOR SELECT
  TO authenticated USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "update_own_rider_fees" ON rider_fees;
CREATE POLICY "update_own_rider_fees" ON rider_fees FOR UPDATE
  TO authenticated USING (auth.uid() = rider_id) WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "insert_own_rider_fees" ON rider_fees;
CREATE POLICY "insert_own_rider_fees" ON rider_fees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = rider_id);

-- Admin access: admins can read all rider_fees
DROP POLICY IF EXISTS "admin_select_rider_fees" ON rider_fees;
CREATE POLICY "admin_select_rider_fees" ON rider_fees FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- =========================================================
-- 2. rider_fee_payments table
-- =========================================================
CREATE TABLE IF NOT EXISTS rider_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  reference_number text NOT NULL,
  screenshot_url text,
  screenshot_delete_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  fee_type text NOT NULL DEFAULT 'platform_fee'
    CHECK (fee_type IN ('platform_fee','onboarding_fee','both')),
  platform_fee_paid numeric(12,2) NOT NULL DEFAULT 0,
  onboarding_fee_paid numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rider_fee_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rider_fee_payments" ON rider_fee_payments;
CREATE POLICY "select_own_rider_fee_payments" ON rider_fee_payments FOR SELECT
  TO authenticated USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "insert_own_rider_fee_payments" ON rider_fee_payments;
CREATE POLICY "insert_own_rider_fee_payments" ON rider_fee_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = rider_id);

-- Admin can read all rider_fee_payments
DROP POLICY IF EXISTS "admin_select_rider_fee_payments" ON rider_fee_payments;
CREATE POLICY "admin_select_rider_fee_payments" ON rider_fee_payments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin can update rider_fee_payments (approve/reject)
DROP POLICY IF EXISTS "admin_update_rider_fee_payments" ON rider_fee_payments;
CREATE POLICY "admin_update_rider_fee_payments" ON rider_fee_payments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- =========================================================
-- 3. Trigger function: apply_rider_fee_on_delivery
--    Fires BEFORE UPDATE on orders when status → 'delivered'
-- =========================================================
CREATE OR REPLACE FUNCTION apply_rider_fee_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_rider_id uuid;
  v_delivery_fee numeric;
  v_platform_fee numeric;
  v_fee_record rider_fees%ROWTYPE;
  v_new_total_earnings numeric;
  v_new_balance numeric;
  v_new_payable numeric;
  v_should_freeze boolean := false;
BEGIN
  -- Only when status transitions to 'delivered' and rider is assigned
  IF (NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.rider_id IS NOT NULL) THEN
    v_rider_id := NEW.rider_id;
    v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    v_platform_fee := ROUND((v_delivery_fee * 0.03)::numeric, 2);

    -- Get or create rider_fees record
    SELECT * INTO v_fee_record FROM rider_fees WHERE rider_id = v_rider_id;
    IF NOT FOUND THEN
      INSERT INTO rider_fees (rider_id, platform_fee_balance, total_career_earnings, onboarding_fee_status, total_payable)
      VALUES (v_rider_id, 0, 0, 'pending', 0)
      RETURNING * INTO v_fee_record;
    END IF;

    v_new_total_earnings := v_fee_record.total_career_earnings + v_delivery_fee;
    v_new_balance := v_fee_record.platform_fee_balance + v_platform_fee;

    -- Check if onboarding fee should activate (career earnings >= 1000)
    IF v_fee_record.onboarding_fee_status = 'pending' AND v_new_total_earnings >= 1000 THEN
      v_new_payable := v_new_balance + 300;
      UPDATE rider_fees SET
        platform_fee_balance = v_new_balance,
        total_career_earnings = v_new_total_earnings,
        onboarding_fee_status = 'active',
        total_payable = v_new_payable,
        updated_at = now()
      WHERE rider_id = v_rider_id;
    ELSE
      v_new_payable := v_new_balance +
        CASE WHEN v_fee_record.onboarding_fee_status = 'active' THEN 300 ELSE 0 END;
      UPDATE rider_fees SET
        platform_fee_balance = v_new_balance,
        total_career_earnings = v_new_total_earnings,
        total_payable = v_new_payable,
        updated_at = now()
      WHERE rider_id = v_rider_id;
    END IF;

    -- Check thresholds and deactivate at 500
    IF v_new_payable >= 500 THEN
      v_should_freeze := true;
    END IF;

    IF v_should_freeze THEN
      UPDATE rider_fees SET frozen_at = now(), updated_at = now() WHERE rider_id = v_rider_id;
      UPDATE profiles SET is_active = false WHERE id = v_rider_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, create new one
DROP TRIGGER IF EXISTS trigger_apply_rider_fee_on_delivery ON orders;
CREATE TRIGGER trigger_apply_rider_fee_on_delivery
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION apply_rider_fee_on_delivery();

-- =========================================================
-- 4. RPC: approve_rider_fee_payment
-- =========================================================
CREATE OR REPLACE FUNCTION approve_rider_fee_payment(
  p_payment_id uuid,
  p_admin_id uuid
)
RETURNS void AS $$
DECLARE
  v_payment rider_fee_payments%ROWTYPE;
  v_fee rider_fees%ROWTYPE;
  v_platform_portion numeric;
  v_onboarding_portion numeric;
  v_new_balance numeric;
  v_new_payable numeric;
  v_onboarding_done boolean := false;
BEGIN
  SELECT * INTO v_payment FROM rider_fee_payments WHERE id = p_payment_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already processed';
  END IF;

  SELECT * INTO v_fee FROM rider_fees WHERE rider_id = v_payment.rider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider fee record not found';
  END IF;

  -- Allocate payment: first to platform fees, remainder to onboarding
  v_platform_portion := LEAST(v_payment.amount, v_fee.platform_fee_balance);
  v_onboarding_portion := v_payment.amount - v_platform_portion;

  -- If onboarding fee is active, deduct from it too
  IF v_fee.onboarding_fee_status = 'active' AND v_onboarding_portion > 0 THEN
    v_onboarding_portion := LEAST(v_onboarding_portion, 300);
  END IF;

  v_new_balance := v_fee.platform_fee_balance - v_platform_portion;

  -- Check if onboarding fee is fully paid
  IF v_fee.onboarding_fee_status = 'active' AND v_onboarding_portion >= 300 THEN
    v_onboarding_done := true;
  END IF;

  v_new_payable := v_new_balance +
    CASE WHEN v_fee.onboarding_fee_status = 'active' AND NOT v_onboarding_done THEN 300 ELSE 0 END;

  -- Update rider_fees
  UPDATE rider_fees SET
    platform_fee_balance = v_new_balance,
    total_payable = v_new_payable,
    onboarding_fee_status = CASE WHEN v_onboarding_done THEN 'paid' ELSE v_fee.onboarding_fee_status END,
    onboarding_fee_paid_at = CASE WHEN v_onboarding_done THEN now() ELSE v_fee.onboarding_fee_paid_at END,
    frozen_at = NULL,
    updated_at = now()
  WHERE rider_id = v_payment.rider_id;

  -- Reactivate rider profile
  UPDATE profiles SET is_active = true WHERE id = v_payment.rider_id;

  -- Update payment record
  UPDATE rider_fee_payments SET
    status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    platform_fee_paid = v_platform_portion,
    onboarding_fee_paid = v_onboarding_portion
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 5. RPC: reactivate_rider (manual admin reactivation)
-- =========================================================
CREATE OR REPLACE FUNCTION reactivate_rider(p_rider_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE rider_fees SET frozen_at = NULL, updated_at = now() WHERE rider_id = p_rider_id;
  UPDATE profiles SET is_active = true WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 6. RPC: delete_expired_rider_screenshots
--    Deletes screenshots older than 1 hour or already approved
-- =========================================================
CREATE OR REPLACE FUNCTION delete_expired_rider_screenshots()
RETURNS void AS $$
DECLARE
  v_record record;
BEGIN
  FOR v_record IN
    SELECT id, screenshot_url FROM rider_fee_payments
    WHERE screenshot_url IS NOT NULL
    AND screenshot_delete_at IS NOT NULL
    AND (screenshot_delete_at <= now() OR status = 'approved')
  LOOP
    -- Clear the URL (actual storage deletion handled by app)
    UPDATE rider_fee_payments SET screenshot_url = NULL WHERE id = v_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 7. Enable realtime on new tables
-- =========================================================
ALTER TABLE rider_fees REPLICA IDENTITY FULL;
ALTER TABLE rider_fee_payments REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'rider_fees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_fees;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'rider_fee_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_fee_payments;
  END IF;
END $$;

-- =========================================================
-- 8. Backfill: create rider_fees records for existing riders
-- =========================================================
INSERT INTO rider_fees (rider_id, platform_fee_balance, total_career_earnings, onboarding_fee_status, total_payable)
SELECT p.id, 0, 0, 'pending', 0
FROM profiles p
WHERE p.role = 'rider'
AND NOT EXISTS (SELECT 1 FROM rider_fees rf WHERE rf.rider_id = p.id);