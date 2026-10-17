-- ============================================
-- Admin Video Calls: RLS policies para sa admin_calls
-- ============================================
-- PROBLEMA: Hindi makatawag ang admin sa user dahil naka-block ng
-- Row Level Security ang pag-insert at pagbasa sa admin_calls table.
-- Patakbuhin itong script na ito sa SQL Editor ng inyong database
-- (SQL Editor → New query → paste → Run).
--
-- Ginagawa nito:
--   1. Admin (role = 'admin' sa profiles) ay puwedeng mag-insert ng bagong tawag.
--   2. Ang target user ay puwedeng makita ang tawag na para sa kanya.
--   3. Ang admin at target user ay puwedeng mag-update ng status ng tawag.
-- ============================================

-- Siguraduhing naka-enable ang RLS
ALTER TABLE public.admin_calls ENABLE ROW LEVEL SECURITY;

-- INSERT: admin lang ang puwedeng gumawa ng tawag
DROP POLICY IF EXISTS "Admin can start calls" ON public.admin_calls;
CREATE POLICY "Admin can start calls" ON public.admin_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- SELECT: makikita ng admin ang sarili niyang mga tawag,
-- at makikita ng target user ang tawag na para sa kanya
DROP POLICY IF EXISTS "Call participants can view calls" ON public.admin_calls;
CREATE POLICY "Call participants can view calls" ON public.admin_calls
  FOR SELECT TO authenticated
  USING (auth.uid() = admin_id OR auth.uid() = target_user_id);

-- UPDATE: admin at target user ay puwedeng mag-update ng status
-- (accepted / declined / ended)
DROP POLICY IF EXISTS "Call participants can update calls" ON public.admin_calls;
CREATE POLICY "Call participants can update calls" ON public.admin_calls
  FOR UPDATE TO authenticated
  USING (auth.uid() = admin_id OR auth.uid() = target_user_id)
  WITH CHECK (auth.uid() = admin_id OR auth.uid() = target_user_id);

-- REALTIME: isama ang admin_calls sa realtime publication para
-- agad na makita ng user ang papasok na tawag (kasama ang polling fallback sa app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_calls;
  END IF;
END $$;
