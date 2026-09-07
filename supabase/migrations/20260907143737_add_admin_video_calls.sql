/*
# Admin Video Call Verification System

## Overview
Allows admins to initiate video calls with any user (seller, buyer, rider)
for identity and legitimacy verification. This is separate from the existing
order-based chat/conversation system since admin calls are not tied to orders.

## New Table: admin_calls
- `id` (uuid, PK)
- `admin_id` (uuid, FK to profiles) — the admin who initiated the call
- `target_user_id` (uuid, FK to profiles) — the user being called
- `room_id` (text, not null) — unique WebRTC signaling room identifier
- `status` (text, not null, default 'pending') — pending | accepted | declined | ended
- `created_at` (timestptz, default now())
- `updated_at` (timestamptz, default now())

## Security (RLS)
- RLS enabled on admin_calls
- SELECT: admin can see calls they made; any user can see calls directed to them
- INSERT: only admin role can create calls (checked via profiles table)
- UPDATE: both admin and target user can update status (accept/decline/end)
- DELETE: only the admin who created the call can delete it

## Notes
1. The admin role is determined by checking profiles.role = 'admin' for the admin_id
2. Target users receive realtime notifications via postgres_changes subscription
3. The room_id is used as the Supabase realtime channel name for WebRTC signaling
*/

CREATE TABLE IF NOT EXISTS admin_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'ended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_calls_admin_id ON admin_calls(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_calls_target_user_id ON admin_calls(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_calls_status ON admin_calls(status);

ALTER TABLE admin_calls ENABLE ROW LEVEL SECURITY;

-- Admin can see calls they made; users can see calls directed to them
DROP POLICY IF EXISTS "admin_calls_select" ON admin_calls;
CREATE POLICY "admin_calls_select" ON admin_calls FOR SELECT
  TO authenticated USING (
    auth.uid() = admin_id OR auth.uid() = target_user_id
  );

-- Only admins can create calls
DROP POLICY IF EXISTS "admin_calls_insert" ON admin_calls;
CREATE POLICY "admin_calls_insert" ON admin_calls FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = admin_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Both admin and target user can update call status
DROP POLICY IF EXISTS "admin_calls_update" ON admin_calls;
CREATE POLICY "admin_calls_update" ON admin_calls FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = admin_id OR auth.uid() = target_user_id
  )
  WITH CHECK (
    auth.uid() = admin_id OR auth.uid() = target_user_id
  );

-- Only the admin who created the call can delete it
DROP POLICY IF EXISTS "admin_calls_delete" ON admin_calls;
CREATE POLICY "admin_calls_delete" ON admin_calls FOR DELETE
  TO authenticated USING (
    auth.uid() = admin_id
  );

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_calls_updated ON admin_calls;
CREATE TRIGGER trigger_admin_calls_updated BEFORE UPDATE ON admin_calls
  FOR EACH ROW EXECUTE FUNCTION update_admin_calls_updated_at();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE admin_calls;
