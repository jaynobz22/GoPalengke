-- Fix: The apply_commission_on_delivery() trigger function has a PL/pgSQL
-- variable named `seller_id` which conflicts with the `stores.seller_id`
-- column reference, causing an "ambiguous column reference" error.
-- This error fires on EVERY order status update to 'delivered', causing
-- the entire UPDATE transaction to fail — so the order never actually
-- changes to 'delivered'. The rider's "Mark as Delivered" button appears
-- to do nothing.
--
-- Fix: rename the local variable to v_seller_id to avoid the collision,
-- and explicitly qualify all column references.

CREATE OR REPLACE FUNCTION apply_commission_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
  current_fee record;
  new_total_sales numeric;
  should_activate_subscription boolean := false;
BEGIN
  -- Only act when status transitions to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT stores.seller_id INTO v_seller_id FROM stores WHERE stores.id = NEW.store_id;
    IF v_seller_id IS NULL THEN RETURN NEW; END IF;

    -- Get current seller_fees
    SELECT * INTO current_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;

    -- Create seller_fees row if it doesn't exist
    IF current_fee IS NULL THEN
      INSERT INTO seller_fees (seller_id, commission_balance, total_sales, subscription_active, subscription_balance, total_payable)
      VALUES (v_seller_id, NEW.commission_amount, NEW.total, false, 0, NEW.commission_amount)
      ON CONFLICT (seller_id) DO NOTHING;

      SELECT * INTO current_fee FROM seller_fees WHERE seller_fees.seller_id = v_seller_id;
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
      WHERE seller_fees.seller_id = v_seller_id;
    ELSE
      UPDATE seller_fees SET
        commission_balance = current_fee.commission_balance + NEW.commission_amount,
        total_sales = new_total_sales,
        total_payable = current_fee.commission_balance + NEW.commission_amount + current_fee.subscription_balance
      WHERE seller_fees.seller_id = v_seller_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
