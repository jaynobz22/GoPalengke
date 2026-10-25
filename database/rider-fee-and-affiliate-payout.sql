-- Existing GoPalengke database only. Run this entire script in one transaction.
-- Keeps the existing 3% delivery accrual; does NOT install another orders trigger.
BEGIN;

-- Stop rather than risk two payout engines. Inspect legacy approval/payout hooks first.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'approve_rider_fee_payment'
  LOOP
    IF pg_get_functiondef(f.oid) ~* '(process_affiliate_milestone|affiliate_transactions|wallet_balance)' THEN
      RAISE EXCEPTION 'Legacy rider approval already handles affiliate payouts. Share the approve_rider_fee_payment definition before installing this script; nothing was changed.';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.rider_fee_payments'::regclass AND NOT t.tgisinternal
      AND t.tgname <> 'trigger_rider_payment_affiliate_v2'
      AND pg_get_functiondef(p.oid) ~* '(process_affiliate_milestone|affiliate_transactions|wallet_balance)'
  ) THEN
    RAISE EXCEPTION 'Another rider payment trigger already handles affiliate payouts. Review it before installing; nothing was changed.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.activate_rider_onboarding_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.onboarding_fee_status = 'pending' AND COALESCE(NEW.total_career_earnings, 0) >= 1000 THEN
    NEW.onboarding_fee_status := 'active';
    -- Reconcile payable rather than adding 300 twice if legacy accrual already added it.
    NEW.total_payable := COALESCE(NEW.platform_fee_balance, 0) + 300;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_rider_onboarding_v2 ON public.rider_fees;
CREATE TRIGGER trigger_rider_onboarding_v2 BEFORE INSERT OR UPDATE ON public.rider_fees
FOR EACH ROW EXECUTE FUNCTION public.activate_rider_onboarding_v2();

-- Atomic per-referral paid-cycle credits, with a unique key for every cycle/tier.
CREATE UNIQUE INDEX IF NOT EXISTS rider_affiliate_cycle_unique_v2
ON public.affiliate_transactions ((substring(description from '\[rider-cycle:[^]]+\]')), tier)
WHERE type IN ('rider_milestone', 'rider_milestone_override')
  AND description LIKE '%[rider-cycle:%';

CREATE OR REPLACE FUNCTION public.credit_rider_affiliate_v2(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; ref record; direct record; sponsor uuid; paid numeric;
  earned_cycles integer; credited_cycles integer; cycle integer; tag text; direct_amount numeric;
BEGIN
  SELECT * INTO p FROM public.rider_fee_payments WHERE id = p_payment_id;
  IF NOT FOUND OR p.status <> 'approved' OR COALESCE(p.platform_fee_paid, 0) <= 0 THEN RETURN; END IF;
  SELECT * INTO ref FROM public.affiliate_referrals
    WHERE referred_user_id = p.rider_id AND referred_role = 'rider' ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO direct FROM public.affiliates WHERE id = ref.affiliate_id;
  IF NOT FOUND THEN RETURN; END IF;
  sponsor := direct.sponsor_id;
  IF sponsor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.affiliates WHERE id = sponsor) THEN
    RAISE EXCEPTION 'Rider affiliate sponsor record is missing';
  END IF;
  -- Same lock order across concurrent referrals and sponsor/direct combinations.
  PERFORM id FROM public.affiliates WHERE id IN (direct.id, sponsor) ORDER BY id FOR UPDATE;
  SELECT COALESCE(sum(platform_fee_paid), 0) INTO paid FROM public.rider_fee_payments
    WHERE rider_id = p.rider_id AND status = 'approved';
  earned_cycles := floor(paid / 500);
  SELECT count(*) INTO credited_cycles FROM public.affiliate_transactions
    WHERE referral_id = ref.id AND type = 'rider_milestone' AND tier = 1 AND status = 'credited';
  IF earned_cycles <= credited_cycles THEN RETURN; END IF;
  direct_amount := CASE WHEN sponsor IS NULL THEN 50 ELSE 35 END;
  FOR cycle IN (credited_cycles + 1)..earned_cycles LOOP
    tag := '[rider-cycle:' || ref.id || ':' || cycle || '] [rfp:' || p.id || ']';
    INSERT INTO public.affiliate_transactions(affiliate_id, referral_id, type, description, amount, status, tier)
      VALUES (direct.id, ref.id, 'rider_milestone', 'Rider milestone - ' || COALESCE(ref.referred_name, 'Rider') || ' ' || tag, direct_amount, 'credited', 1);
    UPDATE public.affiliates SET wallet_balance = COALESCE(wallet_balance,0) + direct_amount,
      lifetime_earnings = COALESCE(lifetime_earnings,0) + direct_amount,
      tier1_earnings = COALESCE(tier1_earnings,0) + direct_amount, updated_at = now() WHERE id = direct.id;
    IF sponsor IS NOT NULL THEN
      INSERT INTO public.affiliate_transactions(affiliate_id, referral_id, type, description, amount, status, tier)
        VALUES (sponsor, ref.id, 'rider_milestone_override', 'Rider upline - ' || COALESCE(ref.referred_name, 'Rider') || ' ' || tag, 15, 'credited', 2);
      UPDATE public.affiliates SET wallet_balance = COALESCE(wallet_balance,0) + 15,
        lifetime_earnings = COALESCE(lifetime_earnings,0) + 15,
        tier2_earnings = COALESCE(tier2_earnings,0) + 15, updated_at = now() WHERE id = sponsor;
    END IF;
    UPDATE public.affiliate_referrals SET milestones_hit = COALESCE(milestones_hit,0) + 1,
      total_commission_earned = COALESCE(total_commission_earned,0) + direct_amount WHERE id = ref.id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.credit_rider_affiliate_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_rider_affiliate_v2(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_rider_payment_affiliate_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' THEN PERFORM public.credit_rider_affiliate_v2(NEW.id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_rider_payment_affiliate_v2() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trigger_rider_payment_affiliate_v2 ON public.rider_fee_payments;
CREATE TRIGGER trigger_rider_payment_affiliate_v2 AFTER INSERT OR UPDATE ON public.rider_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_rider_payment_affiliate_v2();

-- Narrow read for an affiliate's own rider referrals; never exposes other riders' balances.
CREATE OR REPLACE FUNCTION public.affiliate_rider_fee_progress_v2(p_affiliate_id uuid)
RETURNS TABLE(referral_id uuid, platform_fee_balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, COALESCE(f.platform_fee_balance, 0)::numeric
  FROM public.affiliate_referrals r
  JOIN public.affiliates a ON a.id = r.affiliate_id
  LEFT JOIN public.rider_fees f ON f.rider_id = r.referred_user_id
  WHERE r.affiliate_id = p_affiliate_id AND r.referred_role = 'rider' AND a.linked_user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.affiliate_rider_fee_progress_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_rider_fee_progress_v2(uuid) TO authenticated;

UPDATE public.rider_fees SET total_career_earnings = total_career_earnings
WHERE onboarding_fee_status = 'pending' AND total_career_earnings >= 1000;
SELECT public.credit_rider_affiliate_v2(id) FROM public.rider_fee_payments
WHERE status = 'approved' ORDER BY approved_at, created_at, id;
COMMIT;