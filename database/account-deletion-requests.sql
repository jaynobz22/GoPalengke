-- GoPalengke: Account deletion requests (Google Play requirement)
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) <= 100),
  email text NOT NULL CHECK (char_length(email) <= 255),
  phone text CHECK (char_length(phone) <= 20),
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','rider','affiliate')),
  reason text CHECK (char_length(reason) <= 1000),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.account_deletion_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit deletion request" ON public.account_deletion_requests;
CREATE POLICY "Anyone can submit deletion request" ON public.account_deletion_requests
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admin manages deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Admin manages deletion requests" ON public.account_deletion_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
