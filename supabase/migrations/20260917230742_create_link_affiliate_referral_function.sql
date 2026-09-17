/*
# Link Affiliate Referral on Signup

1. New Function: `link_affiliate_referral(p_referral_code text, p_user_id uuid, p_role text, p_full_name text)`
   - SECURITY DEFINER function that creates an affiliate_referrals record
   - Looks up the affiliate by referral_code
   - Validates the role is 'seller' or 'rider'
   - Checks for duplicate (same user already referred)
   - Creates the referral record linking affiliate to the new user
   - Returns true on success, false on failure

2. Security
   - SECURITY DEFINER so it can write to affiliate_referrals regardless of RLS
   - Revoke EXECUTE from anon; grant to authenticated
   - Validates all inputs server-side
*/

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
BEGIN
  -- Validate role
  IF p_role NOT IN ('seller', 'rider') THEN
    RETURN false;
  END IF;

  -- Look up affiliate by referral code
  SELECT id INTO v_affiliate_id FROM affiliates WHERE referral_code = UPPER(TRIM(p_referral_code));
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
