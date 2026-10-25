-- 1) 30-day rent cycle: ₱700 is re-added 30 days after the latest approved rent payment.
CREATE OR REPLACE FUNCTION public.charge_due_rent()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_paid timestamptz; v_base timestamptz; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM seller_fees WHERE subscription_active = true FOR UPDATE LOOP
    SELECT max(approved_at) INTO v_paid FROM fee_payments
      WHERE seller_id = r.seller_id AND status = 'approved' AND subscription_paid > 0;
    v_base := COALESCE(v_paid, r.last_subscription_charge_at);
    IF v_base IS NULL OR now() < v_base + interval '30 days' THEN CONTINUE; END IF;
    -- already charged for this cycle
    IF r.last_subscription_charge_at IS NOT NULL AND r.last_subscription_charge_at >= v_base + interval '30 days' THEN CONTINUE; END IF;
    UPDATE seller_fees SET
      subscription_balance = subscription_balance + 700,
      total_payable = total_payable + 700,
      last_subscription_charge_at = now(),
      updated_at = now()
    WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.charge_due_rent() TO anon, authenticated;

-- 2) Affiliate payout when a seller fee payment is approved:
--    no sponsor -> ₱200 to direct affiliate; with sponsor -> ₱150 direct + ₱50 sponsor.
CREATE OR REPLACE FUNCTION public.credit_seller_affiliate(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; ref record; direct record; tag text; v_direct numeric;
BEGIN
  SELECT * INTO p FROM fee_payments WHERE id = p_payment_id;
  IF p IS NULL OR p.status <> 'approved' OR COALESCE(p.commission_paid,0) <= 0 THEN RETURN; END IF;
  tag := '[fp:' || p.id || ']';
  IF EXISTS (SELECT 1 FROM affiliate_transactions WHERE description LIKE '%' || tag || '%') THEN RETURN; END IF;
  SELECT * INTO ref FROM affiliate_referrals WHERE referred_user_id = p.seller_id AND referred_role = 'seller' ORDER BY created_at LIMIT 1;
  IF ref IS NULL THEN RETURN; END IF;
  SELECT * INTO direct FROM affiliates WHERE id = ref.affiliate_id;
  IF direct IS NULL THEN RETURN; END IF;
  v_direct := CASE WHEN direct.sponsor_id IS NULL THEN 200 ELSE 150 END;

  INSERT INTO affiliate_transactions(affiliate_id, referral_id, type, description, amount, status, tier)
  VALUES (direct.id, ref.id, 'seller_milestone', 'Seller milestone - ' || ref.referred_name || ' ' || tag, v_direct, 'credited', 1);
  UPDATE affiliates SET wallet_balance = wallet_balance + v_direct, lifetime_earnings = lifetime_earnings + v_direct,
    tier1_earnings = tier1_earnings + v_direct, updated_at = now() WHERE id = direct.id;
  UPDATE affiliate_referrals SET milestones_hit = milestones_hit + 1,
    total_commission_earned = total_commission_earned + v_direct WHERE id = ref.id;

  IF direct.sponsor_id IS NOT NULL THEN
    INSERT INTO affiliate_transactions(affiliate_id, referral_id, type, description, amount, status, tier)
    VALUES (direct.sponsor_id, ref.id, 'seller_milestone_override', 'Tier 2 - ' || ref.referred_name || ' (via ' || direct.full_name || ') ' || tag, 50, 'credited', 2);
    UPDATE affiliates SET wallet_balance = wallet_balance + 50, lifetime_earnings = lifetime_earnings + 50,
      tier2_earnings = tier2_earnings + 50, updated_at = now() WHERE id = direct.sponsor_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_fee_payment_affiliate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM public.credit_seller_affiliate(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_fee_payment_affiliate ON public.fee_payments;
CREATE TRIGGER trigger_fee_payment_affiliate AFTER UPDATE ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_fee_payment_affiliate();

-- 3) Credit payments approved before this trigger existed (safe to re-run).
SELECT public.credit_seller_affiliate(id) FROM public.fee_payments WHERE status = 'approved';
