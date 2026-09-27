-- Run this once in the database used by the legacy GoPalengke app.
-- Public pages receive only seller_rank; seller_fees.total_sales remains private.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS seller_rank text NOT NULL DEFAULT 'bagong_sibol';

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_seller_rank_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_seller_rank_check CHECK (
    seller_rank IN (
      'bagong_sibol',
      'suki_magnet',
      'palengke_paborito',
      'hari_ng_pwesto',
      'bantog_na_tindero',
      'alamat_ng_palengke',
      'pambansang_suking_bayan'
    )
  );

CREATE OR REPLACE FUNCTION public.seller_rank_for_sales(_total_sales numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_total_sales, 0) >= 3000000 THEN 'pambansang_suking_bayan'
    WHEN COALESCE(_total_sales, 0) >= 1500000 THEN 'alamat_ng_palengke'
    WHEN COALESCE(_total_sales, 0) >= 750000 THEN 'bantog_na_tindero'
    WHEN COALESCE(_total_sales, 0) >= 300000 THEN 'hari_ng_pwesto'
    WHEN COALESCE(_total_sales, 0) >= 100000 THEN 'palengke_paborito'
    WHEN COALESCE(_total_sales, 0) >= 25000 THEN 'suki_magnet'
    ELSE 'bagong_sibol'
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_store_seller_rank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stores
  SET seller_rank = public.seller_rank_for_sales(NEW.total_sales)
  WHERE seller_id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_store_seller_rank_from_fees ON public.seller_fees;
CREATE TRIGGER sync_store_seller_rank_from_fees
AFTER INSERT OR UPDATE OF total_sales ON public.seller_fees
FOR EACH ROW
EXECUTE FUNCTION public.sync_store_seller_rank();

-- Sellers cannot forge their recognition badge through a browser update.
CREATE OR REPLACE FUNCTION public.protect_store_seller_rank()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.seller_rank := OLD.seller_rank;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_store_seller_rank_from_client ON public.stores;
CREATE TRIGGER protect_store_seller_rank_from_client
BEFORE UPDATE OF seller_rank ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.protect_store_seller_rank();

UPDATE public.stores AS store
SET seller_rank = public.seller_rank_for_sales(fee.total_sales)
FROM public.seller_fees AS fee
WHERE fee.seller_id = store.seller_id;