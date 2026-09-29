-- GoPalengke: onboarding reminder tracking (safe to run more than once)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reminder_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_reminder_7d_at timestamptz;
