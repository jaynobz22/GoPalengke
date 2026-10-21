-- GoPalengke: Beta tester email list (safe to run more than once)
CREATE TABLE IF NOT EXISTS public.beta_testers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 255),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'email_scheduled')),
  added_to_play_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS beta_testers_email_key ON public.beta_testers (lower(email));

GRANT INSERT ON public.beta_testers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_testers TO authenticated;
GRANT ALL ON public.beta_testers TO service_role;

ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join beta" ON public.beta_testers;
CREATE POLICY "Anyone can join beta" ON public.beta_testers
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND added_to_play_at IS NULL);

DROP POLICY IF EXISTS "Admins manage beta testers" ON public.beta_testers;
CREATE POLICY "Admins manage beta testers" ON public.beta_testers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
