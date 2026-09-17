/*
# Two-Tier Affiliate System

1. Schema Changes
- `affiliates` table: add `sponsor_id` (uuid, nullable, FK -> affiliates.id) to track parent affiliate who recruited this affiliate.
- `affiliate_transactions` table: add `tier` (int, default 1) — 1 = direct (Tier 1), 2 = sponsor override (Tier 2).

2. New Function: `process_affiliate_milestone(p_referral_id uuid)`
- SECURITY DEFINER function that processes milestone commissions for a given referral.
- Seller milestone: every ₱1,000 collected → ₱200 total (₱150 Tier 1 direct + ₱50 Tier 2 sponsor if exists).
- Rider milestone: every ₱500 collected → ₱50 total (₱35 Tier 1 direct + ₱15 Tier 2 sponsor if exists).
- Total admin deduction capped at ₱200 for sellers, ₱50 for riders.
- Credits wallet_balance + lifetime_earnings for each affiliate tier.
- Inserts transactions with tier annotation.
- Updates referral's accumulated_admin_collected, milestones_hit, total_commission_earned.

3. Security
- No new RLS policies needed — existing public CRUD policies cover the new columns.
- The `process_affiliate_milestone` function is SECURITY DEFINER so it can update any affiliate's wallet.
*/

-- Add sponsor_id to affiliates (self-referential FK, nullable)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'sponsor_id') THEN
    ALTER TABLE affiliates ADD COLUMN sponsor_id uuid REFERENCES affiliates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add tier column to transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_transactions' AND column_name = 'tier') THEN
    ALTER TABLE affiliate_transactions ADD COLUMN tier int NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add tier1_earnings and tier2_earnings to affiliates for quick dashboard reads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'tier1_earnings') THEN
    ALTER TABLE affiliates ADD COLUMN tier1_earnings numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'tier2_earnings') THEN
    ALTER TABLE affiliates ADD COLUMN tier2_earnings numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Index for sponsor lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_sponsor_id ON affiliates(sponsor_id) WHERE sponsor_id IS NOT NULL;

-- Tier constants:
-- Seller milestone: ₱1,000 collected → ₱200 total (₱150 Tier1 + ₱50 Tier2)
-- Rider milestone: ₱500 collected → ₱50 total (₱35 Tier1 + ₱15 Tier2)

CREATE OR REPLACE FUNCTION public.process_affiliate_milestone(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_referral record;
  v_affiliate_id uuid;
  v_sponsor_id uuid;
  v_milestone_amount numeric;
  v_tier1_amount numeric;
  v_tier2_amount numeric;
  v_milestone_label text;
  v_new_milestones int;
  v_total_deduction numeric;
BEGIN
  -- Load the referral record
  SELECT * INTO v_referral FROM affiliate_referrals WHERE id = p_referral_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_affiliate_id := v_referral.affiliate_id;

  -- Determine milestone thresholds and tier splits based on role
  IF v_referral.referred_role = 'seller' THEN
    v_milestone_amount := 1000;
    v_tier1_amount := 150;
    v_tier2_amount := 50;
    v_milestone_label := 'seller_milestone';
  ELSIF v_referral.referred_role = 'rider' THEN
    v_milestone_amount := 500;
    v_tier1_amount := 35;
    v_tier2_amount := 15;
    v_milestone_label := 'rider_milestone';
  ELSE
    RETURN;
  END IF;

  -- Calculate how many new milestones have been hit
  v_new_milestones := FLOOR(v_referral.accumulated_admin_collected / v_milestone_amount) - v_referral.milestones_hit;
  IF v_new_milestones <= 0 THEN RETURN; END IF;

  -- Look up sponsor (parent affiliate)
  SELECT sponsor_id INTO v_sponsor_id FROM affiliates WHERE id = v_affiliate_id;

  -- Process each new milestone
  FOR i IN 1..v_new_milestones LOOP
    -- Credit Tier 1 (direct affiliate)
    UPDATE affiliates SET
      wallet_balance = wallet_balance + v_tier1_amount,
      lifetime_earnings = lifetime_earnings + v_tier1_amount,
      tier1_earnings = tier1_earnings + v_tier1_amount
    WHERE id = v_affiliate_id;

    INSERT INTO affiliate_transactions (affiliate_id, referral_id, type, description, amount, status, tier)
    VALUES (
      v_affiliate_id,
      p_referral_id,
      v_milestone_label,
      'Direktang Kita (Tier 1) — ' || v_referral.referred_role || ' milestone',
      v_tier1_amount,
      'credited',
      1
    );

    -- Credit Tier 2 (sponsor) if one exists
    IF v_sponsor_id IS NOT NULL THEN
      UPDATE affiliates SET
        wallet_balance = wallet_balance + v_tier2_amount,
        lifetime_earnings = lifetime_earnings + v_tier2_amount,
        tier2_earnings = tier2_earnings + v_tier2_amount
      WHERE id = v_sponsor_id;

      INSERT INTO affiliate_transactions (affiliate_id, referral_id, type, description, amount, status, tier)
      VALUES (
        v_sponsor_id,
        p_referral_id,
        v_milestone_label,
        'Kita sa Sponsor (Tier 2) — ' || v_referral.referred_role || ' milestone',
        v_tier2_amount,
        'credited',
        2
      );
    END IF;
  END LOOP;

  -- Update the referral record
  UPDATE affiliate_referrals SET
    milestones_hit = milestones_hit + v_new_milestones,
    total_commission_earned = total_commission_earned + (v_new_milestones * (v_tier1_amount + COALESCE(CASE WHEN v_sponsor_id IS NOT NULL THEN v_tier2_amount ELSE 0 END, 0)))
  WHERE id = p_referral_id;
END;
$function$;
