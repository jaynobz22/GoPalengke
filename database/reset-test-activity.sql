-- GoPalengke: RESET ng lahat ng test activity (orders, chats, reviews, fees, affiliate earnings)
-- NANANATILI: accounts (profiles), stores, products, affiliates/referrals, settings, QR codes.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reviews','order_items','cart_items','messages','conversations',
    'admin_messages','admin_conversations','admin_calls',
    'fee_payments','rider_fee_payments','seller_fees','rider_fees',
    'affiliate_transactions','affiliate_messages','orders'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'Nilinis: %', t;
    END IF;
  END LOOP;

  -- I-reset ang naipong balance ng affiliates kung may ganitong column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliates' AND column_name='balance') THEN
    EXECUTE 'UPDATE public.affiliates SET balance = 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliates' AND column_name='total_earnings') THEN
    EXECUTE 'UPDATE public.affiliates SET total_earnings = 0';
  END IF;
  -- Seller rank pabalik sa simula
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name='seller_rank') THEN
    EXECUTE 'UPDATE public.stores SET seller_rank = DEFAULT';
  END IF;
  -- Milestone counts ng affiliate pabalik sa zero (kung hindi, ibabawas pa ang lumang ₱1,000 cycle)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliate_referrals' AND column_name='milestones_hit') THEN
    EXECUTE 'UPDATE public.affiliate_referrals SET milestones_hit = 0';
  END IF;
END $$;

-- Verification: dapat lahat 0
SELECT
  (SELECT count(*) FROM public.orders)        AS orders,
  (SELECT count(*) FROM public.messages)      AS messages,
  (SELECT count(*) FROM public.reviews)       AS reviews,
  (SELECT count(*) FROM public.profiles)      AS accounts_natira,
  (SELECT count(*) FROM public.products)      AS paninda_natira;
