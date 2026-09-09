-- Add a flag to track whether commission has already been applied for this order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_applied boolean NOT NULL DEFAULT false;

-- Replace the old trigger that only fired on 'delivered' status
-- New logic: apply commission as soon as the order is paid (payment_status = 'paid')
-- For COD orders, payment is confirmed at delivery, so commission applies when status = 'delivered'
-- Also reverse commission if an order is cancelled after commission was applied

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
  IF NEW.status = 'cancelled' AND NEW.commission_applied = true THEN
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

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_apply_commission ON orders;
DROP TRIGGER IF EXISTS trigger_apply_commission_on_payment ON orders;
CREATE TRIGGER trigger_apply_commission_on_payment
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION apply_commission_on_payment();

-- Backfill: apply commission for already-paid orders that haven't had commission applied yet
-- (orders that were paid before this migration)
DO $$
DECLARE
  o_record record;
  v_seller_id uuid;
  v_fee record;
  v_new_total_sales numeric;
BEGIN
  FOR o_record IN
    SELECT * FROM orders
    WHERE commission_applied = false
      AND payment_status = 'paid'
      AND status != 'cancelled'
      AND commission_amount > 0
  LOOP
    SELECT seller_id INTO v_seller_id FROM stores WHERE stores.id = o_record.store_id;
    IF v_seller_id IS NULL THEN CONTINUE; END IF;

    SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;

    IF v_fee IS NULL THEN
      INSERT INTO seller_fees (seller_id, commission_balance, total_sales, subscription_active, subscription_balance, total_payable)
      VALUES (v_seller_id, o_record.commission_amount, o_record.total, false, 0, o_record.commission_amount)
      ON CONFLICT (seller_id) DO NOTHING;
      SELECT * INTO v_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;
    END IF;

    v_new_total_sales := v_fee.total_sales + o_record.total;

    UPDATE seller_fees SET
      commission_balance = v_fee.commission_balance + o_record.commission_amount,
      total_sales = v_new_total_sales,
      total_payable = v_fee.commission_balance + o_record.commission_amount + v_fee.subscription_balance
    WHERE seller_fees.seller_id = v_seller_id;

    UPDATE orders SET commission_applied = true WHERE id = o_record.id;
  END LOOP;
END $$;

-- Grant execute on the new function
GRANT EXECUTE ON FUNCTION apply_commission_on_payment() TO authenticated;
