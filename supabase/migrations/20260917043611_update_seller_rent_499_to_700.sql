/*
# Update seller billing: ₱499 → ₱700 monthly rent, threshold-activated

## Changes
1. charge_monthly_subscriptions(): ₱499 → ₱700
2. apply_commission_on_payment(): activation charge ₱499 → ₱700
3. Backfill: update existing subscription_balance entries that were charged 499 to 700
   (only the initial activation charge, not per-month charges already applied)
4. Recalculate total_payable for all sellers
*/

-- ============= 1. Update charge_monthly_subscriptions =============
CREATE OR REPLACE FUNCTION charge_monthly_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE seller_fees SET
    subscription_balance = subscription_balance + 700,
    last_subscription_charge_at = now(),
    total_payable = commission_balance + (subscription_balance + 700)
  WHERE subscription_active = true
    AND last_subscription_charge_at IS NOT NULL
    AND last_subscription_charge_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= 2. Update apply_commission_on_payment =============
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
        subscription_balance = v_fee.subscription_balance + 700,
        last_subscription_charge_at = now(),
        total_payable = (v_fee.commission_balance + NEW.commission_amount) + (v_fee.subscription_balance + 700)
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

-- ============= 3. Backfill: adjust existing subscription balances from 499 to 700 =============
-- For sellers who were charged 499 at activation, add the 201 difference
-- so their balance reflects the correct 700 rent.
UPDATE seller_fees
SET subscription_balance = subscription_balance + 201,
    total_payable = commission_balance + (subscription_balance + 201)
WHERE subscription_active = true
  AND subscription_balance >= 499;

-- ============= 4. Recalculate total_payable for all sellers =============
UPDATE seller_fees
SET total_payable = commission_balance + subscription_balance
WHERE total_payable != (commission_balance + subscription_balance);

-- Grant execute on replaced functions
GRANT EXECUTE ON FUNCTION charge_monthly_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION apply_commission_on_payment() TO authenticated;