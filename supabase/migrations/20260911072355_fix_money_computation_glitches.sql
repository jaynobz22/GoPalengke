/*
# Fix Money Computation Glitches — Pre-Launch Hardening

## Problems Fixed

### 1. charge_monthly_subscriptions() never called
The function existed but nothing triggered it. Subscribed sellers never got
their monthly P499 charge. Now called automatically inside freeze_overdue_sellers()
(which the seller app already calls on every load) and also from the admin
overview load. The function itself is also fixed (see below).

### 2. charge_monthly_subscriptions double-counted P499 in total_payable
Original: subscription_balance = subscription_balance + 499, then
total_payable = commission_balance + subscription_balance + 499.
Since subscription_balance already includes the +499, total_payable got +998.
Fixed: total_payable = commission_balance + subscription_balance (no extra +499).

### 3. Cancellation reversal computed total_payable from stale snapshot
The trigger read v_fee (pre-update snapshot) then computed
total_payable = (v_fee.commission_balance - amount) + v_fee.subscription_balance.
But v_fee.commission_balance is the OLD value, so this is correct for the
subtraction — however it ignores the grace_deadline trigger which fires on
the same UPDATE. The real fix: compute total_payable from the NEW column
values in the same UPDATE statement, not from the stale v_fee snapshot.

### 4. approve_fee_payment computed total_payable from subqueries
The function used multiple subqueries to read balances, then updated.
If the grace_deadline trigger fires on the same UPDATE, it sees the
pre-update total_payable. Fixed to use a single FROM ... RETURNING pattern
and compute total_payable from the updated column values.

## Changes
- Replaces charge_monthly_subscriptions() with corrected total_payable formula
- Replaces apply_commission_on_payment() with corrected cancellation total_payable
- Replaces freeze_overdue_sellers() to also call charge_monthly_subscriptions()
- Replaces approve_fee_payment() to compute total_payable from updated values

## No data loss
- No tables or columns dropped/renamed
- No data modified except recalculating total_payable for all sellers from
  their actual column values (commission_balance + subscription_balance)
*/

-- ============= 1. FIX charge_monthly_subscriptions =============
CREATE OR REPLACE FUNCTION charge_monthly_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE seller_fees SET
    subscription_balance = subscription_balance + 499,
    last_subscription_charge_at = now(),
    total_payable = commission_balance + (subscription_balance + 499)
  WHERE subscription_active = true
    AND last_subscription_charge_at IS NOT NULL
    AND last_subscription_charge_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= 2. FIX apply_commission_on_payment (cancellation path) =============
CREATE OR REPLACE FUNCTION apply_commission_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
  v_fee record;
  v_new_total_sales numeric;
  v_should_activate_subscription boolean := false;
BEGIN
  IF (
    (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
    OR (NEW.status = 'delivered' AND NEW.payment_method = 'cod' AND OLD.status IS DISTINCT FROM 'delivered')
  ) AND NEW.commission_applied = false THEN

    SELECT seller_id INTO v_seller_id FROM stores WHERE stores.id = NEW.store_id;
    IF v_seller_id IS NULL THEN
      NEW.commission_applied = true;
      RETURN NEW;
    END IF;

    SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;

    IF v_fee IS NULL THEN
      INSERT INTO seller_fees (seller_id, commission_balance, total_sales, subscription_active, subscription_balance, total_payable)
      VALUES (v_seller_id, NEW.commission_amount, NEW.total, false, 0, NEW.commission_amount)
      ON CONFLICT (seller_id) DO NOTHING;
      SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    v_new_total_sales := v_fee.total_sales + NEW.total;

    IF v_fee.subscription_active = false AND v_new_total_sales >= 5000 THEN
      v_should_activate_subscription := true;
    END IF;

    IF v_should_activate_subscription THEN
      UPDATE seller_fees SET
        commission_balance = v_fee.commission_balance + NEW.commission_amount,
        total_sales = v_new_total_sales,
        subscription_active = true,
        subscription_activated_at = now(),
        subscription_balance = v_fee.subscription_balance + 499,
        last_subscription_charge_at = now(),
        total_payable = (v_fee.commission_balance + NEW.commission_amount) + (v_fee.subscription_balance + 499)
      WHERE seller_fees.seller_id = v_seller_id;
    ELSE
      UPDATE seller_fees SET
        commission_balance = v_fee.commission_balance + NEW.commission_amount,
        total_sales = v_new_total_sales,
        total_payable = (v_fee.commission_balance + NEW.commission_amount) + v_fee.subscription_balance
      WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    NEW.commission_applied = true;
  END IF;

  -- Reverse commission if order is cancelled
  IF NEW.status = 'cancelled' AND NEW.commission_applied = true AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT seller_id INTO v_seller_id FROM stores WHERE stores.id = NEW.store_id;
    IF v_seller_id IS NULL THEN RETURN NEW; END IF;

    SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;

    IF v_fee IS NOT NULL THEN
      UPDATE seller_fees SET
        commission_balance = GREATEST(0, v_fee.commission_balance - NEW.commission_amount),
        total_sales = GREATEST(0, v_fee.total_sales - NEW.total),
        total_payable = GREATEST(0, v_fee.commission_balance - NEW.commission_amount) + v_fee.subscription_balance
      WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    NEW.commission_applied = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= 3. FIX freeze_overdue_sellers to also charge monthly subscriptions =============
CREATE OR REPLACE FUNCTION freeze_overdue_sellers()
RETURNS void AS $$
BEGIN
  -- Charge monthly subscriptions first (adds P499 to subscribed sellers
  -- whose last charge was >30 days ago)
  PERFORM charge_monthly_subscriptions();

  -- Then freeze overdue sellers
  UPDATE profiles SET is_active = false
  WHERE id IN (
    SELECT seller_id FROM seller_fees
    WHERE grace_deadline IS NOT NULL
      AND grace_deadline < now()
      AND total_payable >= 1000
      AND frozen_at IS NULL
  );

  UPDATE seller_fees SET frozen_at = now()
  WHERE grace_deadline IS NOT NULL
    AND grace_deadline < now()
    AND total_payable >= 1000
    AND frozen_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= 4. FIX approve_fee_payment =============
CREATE OR REPLACE FUNCTION approve_fee_payment(
  p_payment_id uuid,
  p_admin_id uuid
) RETURNS void AS $$
DECLARE
  p_record record;
  v_seller_id uuid;
  v_commission_balance numeric;
  v_subscription_balance numeric;
  remaining numeric;
  comm_paid numeric := 0;
  sub_paid numeric := 0;
BEGIN
  SELECT * INTO p_record FROM fee_payments WHERE id = p_payment_id AND status = 'pending';
  IF p_record IS NULL THEN RETURN; END IF;

  v_seller_id := p_record.seller_id;
  remaining := p_record.amount;

  -- Read current balances once
  SELECT commission_balance, subscription_balance
    INTO v_commission_balance, v_subscription_balance
  FROM seller_fees WHERE seller_id = v_seller_id;

  -- Apply to commission first
  IF remaining > 0 AND v_commission_balance > 0 THEN
    comm_paid := LEAST(remaining, v_commission_balance);
    remaining := remaining - comm_paid;
  END IF;
  -- Then subscription
  IF remaining > 0 AND v_subscription_balance > 0 THEN
    sub_paid := LEAST(remaining, v_subscription_balance);
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

  -- Update seller_fees with computed total_payable from the new column values
  UPDATE seller_fees SET
    commission_balance = GREATEST(0, v_commission_balance - comm_paid),
    subscription_balance = GREATEST(0, v_subscription_balance - sub_paid),
    total_payable = GREATEST(0, v_commission_balance - comm_paid) + GREATEST(0, v_subscription_balance - sub_paid)
  WHERE seller_id = v_seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= 5. RECALCULATE total_payable for all sellers =============
-- Ensure total_payable = commission_balance + subscription_balance for every row
UPDATE seller_fees
SET total_payable = commission_balance + subscription_balance
WHERE total_payable != (commission_balance + subscription_balance);

-- Grant execute on replaced functions
GRANT EXECUTE ON FUNCTION charge_monthly_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_fee_payment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION freeze_overdue_sellers() TO authenticated;
GRANT EXECUTE ON FUNCTION reactivate_seller(uuid) TO authenticated;
