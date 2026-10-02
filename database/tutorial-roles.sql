ALTER TABLE public.tutorial_videos ADD COLUMN IF NOT EXISTS target_role text NOT NULL DEFAULT 'all';
