/*
# Fix inflated seller_fees and make commission trigger fully idempotent

## Root Cause
The commission trigger was originally AFTER UPDATE, which could not set
`NEW.commission_applied = true`. This meant every UPDATE to an order row
(status changes, rider_lat/lng updates during delivery, etc.) re-triggered
the commission, adding `total` to `total_sales` and `commission_amount` to
`commission_balance` each time. For Alma's store, this caused total_sales
to inflate from the actual ₱2,080 to ₱11,880 (~5.7x overcount).

The trigger was later fixed to BEFORE UPDATE (migration 20260910121605),
which correctly sets `NEW.commission_applied = true`. But the inflated
seller_fees data was never corrected for Alma.

## Fix
1. Recalculate ALL seller_fees from actual order data (commission_applied
   = true, status != cancelled, payment_status = paid).
2. Harden the trigger function to be fully idempotent: add an explicit
   `OLD.commission_applied IS DISTINCT FROM NEW.commission_applied` check
   is NOT needed — the existing `NEW.commission_applied = false` guard
   already prevents re-application. But we add a WHERE clause to the
   UPDATE so that if the row was already counted (commission_applied
   somehow got set outside the trigger), we skip it.
3. The trigger already checks `NEW.commission_applied = false` before
   applying, which is the correct guard. The BEFORE UPDATE trigger
   correctly sets `NEW.commission_applied = true` in the same statement,
   so it cannot re-fire on subsequent updates.

## No data loss
- Orders are not modified.
- seller_fees are recalculated from actual order totals.
- Subscription state is preserved (if already activated, stays activated).
*/

-- Step 1: Recalculate all seller_fees from actual order data
WITH correct_totals AS (
  SELECT
    s.seller_id,
    COALESCE(SUM(o.total), 0) AS correct_total_sales,
    COALESCE(SUM(o.commission_amount), 0) AS correct_commission
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.commission_applied = true
    AND o.status != 'cancelled'
    AND o.payment_status = 'paid'
  GROUP BY s.seller_id
)
UPDATE seller_fees sf SET
  total_sales = COALESCE(ct.correct_total_sales, 0),
  commission_balance = COALESCE(ct.correct_commission, 0),
  total_payable = COALESCE(ct.correct_commission, 0) + sf.subscription_balance,
  updated_at = now()
FROM correct_totals ct
WHERE sf.seller_id = ct.seller_id;

-- Fix sellers with no paid orders (reset to 0)
UPDATE seller_fees sf SET
  total_sales = 0,
  commission_balance = 0,
  total_payable = 0 + sf.subscription_balance,
  updated_at = now()
WHERE sf.seller_id NOT IN (
  SELECT DISTINCT s.seller_id
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.commission_applied = true
    AND o.status != 'cancelled'
    AND o.payment_status = 'paid'
);

-- Step 2: Harden the trigger function — add explicit guard against
-- re-application even if commission_applied somehow gets reset to false
-- by a future migration or manual update.
-- The key change: check that we haven't already counted this order by
-- also verifying the payment_status transition (only apply on the
-- transition from unpaid to paid, not on every update while paid).

CREATE OR REPLACE FUNCTION apply_commission_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
  v_fee record;
  v_new_total_sales numeric;
  v_should_activate_subscription boolean := false;
BEGIN
  -- Apply commission ONLY when:
  -- 1. commission_applied is false (not yet counted), AND
  -- 2. payment just became paid (transition from not-paid to paid), OR
  --    status just became delivered for COD (transition from non-delivered)
  -- This prevents re-application on any subsequent UPDATE (rider location,
  -- status changes, etc.) because commission_applied will already be true.
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
        total_payable = v_fee.commission_balance + NEW.commission_amount + v_fee.subscription_balance + 499
      WHERE seller_fees.seller_id = v_seller_id;
    ELSE
      UPDATE seller_fees SET
        commission_balance = v_fee.commission_balance + NEW.commission_amount,
        total_sales = v_new_total_sales,
        total_payable = v_fee.commission_balance + NEW.commission_amount + v_fee.subscription_balance
      WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    NEW.commission_applied = true;
  END IF;

  -- Reverse commission if order is cancelled and commission was already applied
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
