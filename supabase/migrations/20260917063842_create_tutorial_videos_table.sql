/*
# Create tutorial_videos table

1. New Tables
- `tutorial_videos`
  - `id` (uuid, primary key)
  - `youtube_url` (text, not null) — full YouTube URL pasted by admin
  - `youtube_id` (text, not null) — extracted video ID for embedding
  - `title` (text, not null) — title set by admin
  - `description` (text) — optional description set by admin
  - `sort_order` (int, default 0) — ordering for display
  - `is_active` (boolean, default true) — can be toggled to hide without deleting
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `tutorial_videos`.
- Public read: anyone (anon + authenticated) can view active tutorials.
- Admin-only write: only users with role='admin' in profiles can insert, update, delete.
*/

CREATE TABLE IF NOT EXISTS tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url text NOT NULL,
  youtube_id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tutorial_videos ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can view tutorials
DROP POLICY IF EXISTS "public_read_tutorials" ON tutorial_videos;
CREATE POLICY "public_read_tutorials"
  ON tutorial_videos FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin-only insert
DROP POLICY IF EXISTS "admin_insert_tutorials" ON tutorial_videos;
CREATE POLICY "admin_insert_tutorials"
  ON tutorial_videos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin-only update
DROP POLICY IF EXISTS "admin_update_tutorials" ON tutorial_videos;
CREATE POLICY "admin_update_tutorials"
  ON tutorial_videos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin-only delete
DROP POLICY IF EXISTS "admin_delete_tutorials" ON tutorial_videos;
CREATE POLICY "admin_delete_tutorials"
  ON tutorial_videos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
