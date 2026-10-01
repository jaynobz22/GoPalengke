-- Mark stores as DEMO so their products show a "DEMO" label to buyers
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
UPDATE public.stores SET is_demo = true WHERE id::text LIKE 'a0000001-0000-0000-0000-%';
