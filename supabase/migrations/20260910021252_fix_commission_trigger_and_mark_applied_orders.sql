-- Fix: Mark all paid non-cancelled orders as commission_applied = true
-- so future backfills don't re-apply commission.
-- Also fix the trigger to handle the case where commission_amount = 0
-- (the order should still count toward total_sales but add 0 to commission_balance).

UPDATE orders SET commission_applied = true
WHERE payment_status = 'paid'
  AND status != 'cancelled'
  AND commission_applied = false;

-- Replace the trigger function with a corrected version that:
-- 1. Uses commission_applied guard (already present)
-- 2. Properly handles commission_amount = 0 (still adds total to total_sales)
-- 3. Uses BEFORE UPDATE instead of AFTER UPDATE so we can set commission_applied
--    in the same row (NEW.commission_applied = true works correctly)

CREATE OR REPLACE FUNCTION apply_commission_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
  v_fee record;
  v_new_total_sales numeric;
  v_should_activate_subscription boolean := false;
BEGIN
  -- Apply commission when payment is confirmed
  -- For QR: payment_status changes to 'paid' (can happen at any status >= accepted)
  -- For COD: status changes to 'delivered' (payment confirmed at delivery)
  IF (NEW.payment_status = 'paid' AND NEW.commission_applied = false) OR
     (NEW.status = 'delivered' AND NEW.payment_method = 'cod' AND NEW.commission_applied = false) THEN

    SELECT seller_id INTO v_seller_id FROM stores WHERE stores.id = NEW.store_id;
    IF v_seller_id IS NULL THEN RETURN NEW; END IF;

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

    -- Mark commission as applied so it doesn't get double-counted
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

-- The trigger is already named trigger_apply_commission_on_payment
-- and is already attached. No need to drop/recreate it.
