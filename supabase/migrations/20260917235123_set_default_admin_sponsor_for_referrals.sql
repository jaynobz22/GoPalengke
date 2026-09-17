/*
# Default Admin Sponsor for Affiliate Program

1. Ensure the admin affiliate account with referral code 5F7249C1 exists
   - If not exists, create it with email admin@gopalengke.ph
   - This account serves as the default sponsor for all affiliates and referrals
     that come in without a referral code

2. Update `link_affiliate_referral` function
   - If p_referral_code is NULL or empty, default to the admin affiliate (5F7249C1)
   - This ensures every seller/rider who signs up without a referral code
     is automatically tracked under the admin's affiliate account

3. Security
   - No new RLS policies needed
   - The function remains SECURITY DEFINER with authenticated-only EXECUTE
*/

-- Ensure admin affiliate account exists with referral code 5F7249C1
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM affiliates WHERE referral_code = '5F7249C1';
  IF v_admin_id IS NULL THEN
    INSERT INTO affiliates (email, full_name, referral_code, password_hash, promo_code)
    VALUES ('admin@gopalengke.ph', 'GoPalengke Admin', '5F7249C1', '0', 'ADMIN')
    ON CONFLICT (referral_code) DO NOTHING
    RETURNING id INTO v_admin_id;
  END IF;
END $$;

-- Updated function: defaults to admin affiliate when no referral code provided
CREATE OR REPLACE FUNCTION public.link_affiliate_referral(
  p_referral_code text,
  p_user_id uuid,
  p_role text,
  p_full_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_affiliate_id uuid;
  v_existing uuid;
  v_code text;
BEGIN
  -- Validate role
  IF p_role NOT IN ('seller', 'rider') THEN
    RETURN false;
  END IF;

  -- Use provided code, or default to admin's code 5F7249C1
  v_code := NULLIF(TRIM(p_referral_code), '');
  IF v_code IS NULL THEN
    v_code := '5F7249C1';
  END IF;

  -- Look up affiliate by referral code
  SELECT id INTO v_affiliate_id FROM affiliates WHERE referral_code = UPPER(v_code);
  IF v_affiliate_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if this user was already referred by someone
  SELECT id INTO v_existing FROM affiliate_referrals WHERE referred_user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Create the referral record
  INSERT INTO affiliate_referrals (affiliate_id, referred_user_id, referred_role, referred_name)
  VALUES (v_affiliate_id, p_user_id, p_role, p_full_name);

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION link_affiliate_referral FROM anon;
GRANT EXECUTE ON FUNCTION link_affiliate_referral TO authenticated;
