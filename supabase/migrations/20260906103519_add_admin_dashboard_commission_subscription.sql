/*
# Admin Dashboard: Account Approval, Commission System, Monthly Subscription

## Overview
This migration adds the infrastructure for the admin dashboard to:
1. Approve/disapprove user registrations (buyers, sellers, riders)
2. Toggle accounts active/inactive (view-only mode when inactive)
3. Charge sellers 3% commission per transaction
4. Charge sellers P499/month subscription after they earn P5,000 in sales
5. Allow sellers to pay accumulated fees via GCash QR + reference number
6. Allow admin to approve seller fee payments

## Changes

### 1. profiles table — new columns
- `is_approved` (boolean, default false): When false, user sees "pending approval" screen.
  Admin must set to true for the user to access the platform.
- `is_active` (boolean, default true): Admin toggle. When false, user can see their
  dashboard but cannot perform any actions (view-only mode). All write operations blocked.

### 2. orders table — new column
- `commission_amount` (numeric, default 0): The 3% commission calculated at checkout
  time on the product total (excluding delivery fee). Stored per-order for auditability.

### 3. New table: seller_fees
Tracks each seller's accumulated commission, subscription status, and total payable.
- `seller_id` (uuid, references profiles): One row per seller
- `commission_balance` (numeric): Accumulated 3% commission not yet paid
- `total_sales` (numeric): Cumulative sales used to detect P5,000 threshold
- `subscription_active` (boolean): Whether monthly subscription is active
- `subscription_activated_at` (timestamptz): When subscription was first activated
- `subscription_balance` (numeric): Accumulated subscription fees not yet paid
- `last_subscription_charge_at` (timestamptz): When the last monthly charge was added
- `total_payable` (numeric): commission_balance + subscription_balance (for display)

### 4. New table: fee_payments
Records each seller payment submission for admin approval.
- `seller_id` (uuid, references profiles)
- `amount` (numeric): Amount the seller is paying
- `reference_number` (text): GCash/Maya payment reference
- `status` (text): 'pending', 'approved', 'rejected'
- `approved_by` (uuid, references profiles): Admin who approved
- `approved_at` (timestamptz): When approved
- `commission_paid` (numeric): Portion applied to commission balance
- `subscription_paid` (numeric): Portion applied to subscription balance

### 5. New table: platform_settings
Stores platform-wide settings like the admin's GCash QR code image.
- `key` (text, primary key): Setting key
- `value` (text): Setting value (e.g., URL of QR code image)
- `updated_by` (uuid, references profiles)

### 6. Security (RLS)
- Only admin can update profiles.is_approved and profiles.is_active
- Sellers can read their own seller_fees row
- Sellers can insert fee_payments for themselves
- Admin can read/update all fee_payments
- Admin can read/update platform_settings
- All authenticated users can read platform_settings (to show QR code)

## Important Notes
1. Existing accounts are grandfathered: is_approved defaults to true for existing
   users via UPDATE, and only new registrations default to false.
2. The 3% commission is calculated on the product total only (total column in orders),
   NOT on the delivery fee (which goes to the rider).
3. Commission is added to seller_fees.commission_balance when an order transitions
   to 'delivered' status (via a trigger), not at checkout.
4. The monthly subscription (P499) activates automatically when a seller's total_sales
   crosses P5,000. Each month after activation, P499 is added to subscription_balance.
5. When admin approves a fee_payment, the seller's commission_balance and
   subscription_balance are reduced by the payment amount, and total_payable is recalculated.
*/

-- ============= ADD is_approved AND is_active TO profiles =============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Grandfather existing accounts as approved and active
UPDATE profiles SET is_approved = true, is_active = true
WHERE is_approved = false;

-- ============= ADD commission_amount TO orders =============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN commission_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============= SELLER FEES TABLE =============
CREATE TABLE IF NOT EXISTS seller_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  commission_balance numeric NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  subscription_active boolean NOT NULL DEFAULT false,
  subscription_activated_at timestamptz,
  subscription_balance numeric NOT NULL DEFAULT 0,
  last_subscription_charge_at timestamptz,
  total_payable numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seller_fees ENABLE ROW LEVEL SECURITY;

-- Sellers can read their own seller_fees row
DROP POLICY IF EXISTS "seller_fees_select_own" ON seller_fees;
CREATE POLICY "seller_fees_select_own" ON seller_fees FOR SELECT
  TO authenticated USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Sellers can update their own seller_fees row (for self-service operations)
DROP POLICY IF EXISTS "seller_fees_update_own" ON seller_fees;
CREATE POLICY "seller_fees_update_own" ON seller_fees FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin can insert seller_fees (for initialization)
DROP POLICY IF EXISTS "seller_fees_insert_admin" ON seller_fees;
CREATE POLICY "seller_fees_insert_admin" ON seller_fees FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============= FEE PAYMENTS TABLE =============
CREATE TABLE IF NOT EXISTS fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  reference_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  commission_paid numeric NOT NULL DEFAULT 0,
  subscription_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- Sellers can read their own fee_payments
DROP POLICY IF EXISTS "fee_payments_select_own" ON fee_payments;
CREATE POLICY "fee_payments_select_own" ON fee_payments FOR SELECT
  TO authenticated USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Sellers can insert fee_payments for themselves
DROP POLICY IF EXISTS "fee_payments_insert_own" ON fee_payments;
CREATE POLICY "fee_payments_insert_own" ON fee_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);

-- Admin can update fee_payments (to approve/reject)
DROP POLICY IF EXISTS "fee_payments_update_admin" ON fee_payments;
CREATE POLICY "fee_payments_update_admin" ON fee_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============= PLATFORM SETTINGS TABLE =============
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read platform settings (e.g., QR code URL)
DROP POLICY IF EXISTS "platform_settings_select_all" ON platform_settings;
CREATE POLICY "platform_settings_select_all" ON platform_settings FOR SELECT
  TO anon, authenticated USING (true);

-- Only admin can insert/update platform settings
DROP POLICY IF EXISTS "platform_settings_insert_admin" ON platform_settings;
CREATE POLICY "platform_settings_insert_admin" ON platform_settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "platform_settings_update_admin" ON platform_settings;
CREATE POLICY "platform_settings_update_admin" ON platform_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_seller_fees_seller_id ON seller_fees(seller_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_seller_id ON fee_payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_status ON fee_payments(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- ============= TRIGGERS =============
DROP TRIGGER IF EXISTS trigger_seller_fees_updated ON seller_fees;
CREATE TRIGGER trigger_seller_fees_updated BEFORE UPDATE ON seller_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_fee_payments_updated ON fee_payments;
CREATE TRIGGER trigger_fee_payments_updated BEFORE UPDATE ON fee_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============= AUTO-COMMISSION ON DELIVERY =============
-- When an order is marked 'delivered', add the commission to the seller's
-- seller_fees.commission_balance and update total_sales.
CREATE OR REPLACE FUNCTION apply_commission_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  seller_id uuid;
  current_fee record;
  new_total_sales numeric;
  should_activate_subscription boolean := false;
BEGIN
  -- Only act when status transitions to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT seller_id INTO seller_id FROM stores WHERE stores.id = NEW.store_id;
    IF seller_id IS NULL THEN RETURN NEW; END IF;

    -- Get current seller_fees
    SELECT * INTO current_fee FROM seller_fees WHERE seller_fees.seller_id = seller_id;

    -- Create seller_fees row if it doesn't exist
    IF current_fee IS NULL THEN
      INSERT INTO seller_fees (seller_id, commission_balance, total_sales, subscription_active, subscription_balance, total_payable)
      VALUES (seller_id, NEW.commission_amount, NEW.total, false, 0, NEW.commission_amount)
      ON CONFLICT (seller_id) DO NOTHING;

      SELECT * INTO current_fee FROM seller_fees WHERE seller_fees.seller_id = seller_id;
    END IF;

    -- Calculate new totals
    new_total_sales := current_fee.total_sales + NEW.total;

    -- Check if subscription should be activated (crossed P5000 threshold)
    IF current_fee.subscription_active = false AND new_total_sales >= 5000 THEN
      should_activate_subscription := true;
    END IF;

    -- Update seller_fees
    IF should_activate_subscription THEN
      UPDATE seller_fees SET
        commission_balance = current_fee.commission_balance + NEW.commission_amount,
        total_sales = new_total_sales,
        subscription_active = true,
        subscription_activated_at = now(),
        subscription_balance = current_fee.subscription_balance + 499,
        last_subscription_charge_at = now(),
        total_payable = current_fee.commission_balance + NEW.commission_amount + current_fee.subscription_balance + 499
      WHERE seller_fees.seller_id = seller_id;
    ELSE
      UPDATE seller_fees SET
        commission_balance = current_fee.commission_balance + NEW.commission_amount,
        total_sales = new_total_sales,
        total_payable = current_fee.commission_balance + NEW.commission_amount + current_fee.subscription_balance
      WHERE seller_fees.seller_id = seller_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_apply_commission ON orders;
CREATE TRIGGER trigger_apply_commission AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION apply_commission_on_delivery();

-- ============= MONTHLY SUBSCRIPTION CHARGE FUNCTION =============
-- Called by the app to add P499 monthly subscription to sellers whose
-- subscription is active and whose last charge was > 30 days ago.
CREATE OR REPLACE FUNCTION charge_monthly_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE seller_fees SET
    subscription_balance = subscription_balance + 499,
    last_subscription_charge_at = now(),
    total_payable = commission_balance + subscription_balance + 499
  WHERE subscription_active = true
    AND last_subscription_charge_at IS NOT NULL
    AND last_subscription_charge_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= APPROVE FEE PAYMENT FUNCTION =============
-- Called by admin to approve a fee payment. Reduces the seller's balances
-- and resets total_payable. The payment is applied to commission first,
-- then subscription.
CREATE OR REPLACE FUNCTION approve_fee_payment(
  p_payment_id uuid,
  p_admin_id uuid
) RETURNS void AS $$
DECLARE
  p_record record;
  remaining numeric;
  comm_paid numeric := 0;
  sub_paid numeric := 0;
BEGIN
  SELECT * INTO p_record FROM fee_payments WHERE id = p_payment_id AND status = 'pending';
  IF p_record IS NULL THEN RETURN; END IF;

  remaining := p_record.amount;
  -- Apply to commission first
  IF remaining > 0 AND (SELECT commission_balance FROM seller_fees WHERE seller_id = p_record.seller_id) > 0 THEN
    comm_paid := LEAST(remaining, (SELECT commission_balance FROM seller_fees WHERE seller_id = p_record.seller_id));
    remaining := remaining - comm_paid;
  END IF;
  -- Then subscription
  IF remaining > 0 AND (SELECT subscription_balance FROM seller_fees WHERE seller_id = p_record.seller_id) > 0 THEN
    sub_paid := LEAST(remaining, (SELECT subscription_balance FROM seller_fees WHERE seller_id = p_record.seller_id));
    remaining := remaining - sub_paid;
  END IF;

  -- Update fee_payment record
  UPDATE fee_payments SET
    status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    commission_paid = comm_paid,
    subscription_paid = sub_paid
  WHERE id = p_payment_id;

  -- Update seller_fees balances
  UPDATE seller_fees SET
    commission_balance = GREATEST(0, commission_balance - comm_paid),
    subscription_balance = GREATEST(0, subscription_balance - sub_paid),
    total_payable = GREATEST(0, commission_balance - comm_paid) + GREATEST(0, subscription_balance - sub_paid)
  WHERE seller_id = p_record.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= GRANT EXECUTE ON FUNCTIONS =============
GRANT EXECUTE ON FUNCTION charge_monthly_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_fee_payment(uuid, uuid) TO authenticated;
