/*
# Fix rider billing: reset warnings on approval + clarify freeze behavior

## Changes
1. Update approve_rider_fee_payment to reset warning_80_sent_at and warning_90_sent_at to NULL
   so warnings can re-trigger in the next billing cycle after a rider pays.
2. Update reactivate_rider to also reset warning flags.
3. The rider app already allows login and viewing when frozen — only delivery acceptance is blocked.
*/

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

  v_platform_portion := LEAST(v_payment.amount, v_fee.platform_fee_balance);
  v_onboarding_portion := v_payment.amount - v_platform_portion;

  IF v_fee.onboarding_fee_status = 'active' AND v_onboarding_portion > 0 THEN
    v_onboarding_portion := LEAST(v_onboarding_portion, 300);
  END IF;

  v_new_balance := v_fee.platform_fee_balance - v_platform_portion;

  IF v_fee.onboarding_fee_status = 'active' AND v_onboarding_portion >= 300 THEN
    v_onboarding_done := true;
  END IF;

  v_new_payable := v_new_balance +
    CASE WHEN v_fee.onboarding_fee_status = 'active' AND NOT v_onboarding_done THEN 300 ELSE 0 END;

  UPDATE rider_fees SET
    platform_fee_balance = v_new_balance,
    total_payable = v_new_payable,
    onboarding_fee_status = CASE WHEN v_onboarding_done THEN 'paid' ELSE v_fee.onboarding_fee_status END,
    onboarding_fee_paid_at = CASE WHEN v_onboarding_done THEN now() ELSE v_fee.onboarding_fee_paid_at END,
    frozen_at = NULL,
    warning_80_sent_at = NULL,
    warning_90_sent_at = NULL,
    updated_at = now()
  WHERE rider_id = v_payment.rider_id;

  UPDATE profiles SET is_active = true WHERE id = v_payment.rider_id;

  UPDATE rider_fee_payments SET
    status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    platform_fee_paid = v_platform_portion,
    onboarding_fee_paid = v_onboarding_portion
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reactivate_rider(p_rider_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE rider_fees SET
    frozen_at = NULL,
    warning_80_sent_at = NULL,
    warning_90_sent_at = NULL,
    updated_at = now()
  WHERE rider_id = p_rider_id;
  UPDATE profiles SET is_active = true WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;