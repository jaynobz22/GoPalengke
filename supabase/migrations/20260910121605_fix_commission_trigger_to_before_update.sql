-- Fix: The trigger was AFTER UPDATE but the function sets NEW.commission_applied = true,
-- which only works in a BEFORE trigger. Migration 20260910021252 replaced the function
-- but never dropped/recreated the trigger itself, so it stayed AFTER UPDATE.
-- This meant commission was added to seller_fees but commission_applied stayed false,
-- so orders didn't show in the seller's billing transactions list.

-- Drop the AFTER trigger and recreate as BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_apply_commission_on_payment ON orders;

CREATE TRIGGER trigger_apply_commission_on_payment
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION apply_commission_on_payment();

-- Backfill: apply commission for the 2 paid orders that were missed
-- (their commission was likely already added to seller_fees by the AFTER trigger,
-- but commission_applied stayed false, so we need to mark them true without
-- double-counting. We'll recalculate seller_fees from scratch to be safe.)
DO $$
DECLARE
  o_record record;
  v_seller_id uuid;
  v_fee record;
  v_new_total_sales numeric;
  v_should_activate boolean := false;
BEGIN
  FOR o_record IN
    SELECT * FROM orders
    WHERE commission_applied = false
      AND payment_status = 'paid'
      AND status != 'cancelled'
      AND commission_amount > 0
  LOOP
    SELECT seller_id INTO v_seller_id FROM stores WHERE stores.id = o_record.store_id;
    IF v_seller_id IS NULL THEN
      UPDATE orders SET commission_applied = true WHERE id = o_record.id;
      CONTINUE;
    END IF;

    SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;

    IF v_fee IS NULL THEN
      INSERT INTO seller_fees (seller_id, commission_balance, total_sales, subscription_active, subscription_balance, total_payable)
      VALUES (v_seller_id, o_record.commission_amount, o_record.total, false, 0, o_record.commission_amount)
      ON CONFLICT (seller_id) DO NOTHING;
      SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    v_new_total_sales := v_fee.total_sales + o_record.total;

    IF v_fee.subscription_active = false AND v_new_total_sales >= 5000 THEN
      v_should_activate := true;
    END IF;

    IF v_should_activate THEN
      UPDATE seller_fees SET
        commission_balance = v_fee.commission_balance + o_record.commission_amount,
        total_sales = v_new_total_sales,
        subscription_active = true,
        subscription_activated_at = now(),
        subscription_balance = v_fee.subscription_balance + 499,
        last_subscription_charge_at = now(),
        total_payable = v_fee.commission_balance + o_record.commission_amount + v_fee.subscription_balance + 499
      WHERE seller_fees.seller_id = v_seller_id;
    ELSE
      UPDATE seller_fees SET
        commission_balance = v_fee.commission_balance + o_record.commission_amount,
        total_sales = v_new_total_sales,
        total_payable = v_fee.commission_balance + o_record.commission_amount + v_fee.subscription_balance
      WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    UPDATE orders SET commission_applied = true WHERE id = o_record.id;
  END LOOP;
END $$;
