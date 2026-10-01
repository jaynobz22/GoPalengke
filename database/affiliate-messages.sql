-- Admin <-> Affiliate chat + payout notifications
CREATE TABLE IF NOT EXISTS public.affiliate_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('admin','affiliate')),
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_messages_aff_idx ON public.affiliate_messages(affiliate_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.affiliate_messages TO anon, authenticated;
GRANT ALL ON public.affiliate_messages TO service_role;
ALTER TABLE public.affiliate_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_messages_all" ON public.affiliate_messages;
CREATE POLICY "affiliate_messages_all" ON public.affiliate_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_messages;
