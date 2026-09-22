-- Fix: apply_rider_fee_on_delivery fires per-row when markDelivered updates
-- all orders in a delivery group at once. For multi-pickup groups, the rider
-- should only earn ONE delivery fee (the first order's), not the sum of all.
-- Solution: skip the fee addition if another order in the same delivery
-- group was already marked delivered in the same transaction (same rider_id,
-- same delivery_group_id, already delivered, but skip self).
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
  v_already_counted boolean := false;
BEGIN
  -- Only when status transitions to 'delivered' and rider is assigned
  IF (NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.rider_id IS NOT NULL) THEN
    v_rider_id := NEW.rider_id;
    v_delivery_fee := COALESCE(NEW.delivery_fee, 0);

    -- For delivery groups: check if another order in the same group was
    -- already marked delivered in this same transaction. If so, skip —
    -- the rider fee was already applied for the first order.
    IF NEW.delivery_group_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE delivery_group_id = NEW.delivery_group_id
          AND id <> NEW.id
          AND status = 'delivered'
          AND rider_id = v_rider_id
      ) INTO v_already_counted;
    END IF;

    IF NOT v_already_counted THEN
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
