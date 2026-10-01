-- Welcome email tracking: para hindi maulit ang pagpapadala sa parehong user.
-- Patakbuhin ito nang isang beses sa Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
