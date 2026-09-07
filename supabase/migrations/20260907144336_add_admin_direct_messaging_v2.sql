/*
# Admin Direct Messaging (Live Support)

## Overview
Allows admins to send direct private messages to any user (seller, buyer, rider)
for live support — a lightweight chat system separate from the order-based
conversation system. Admin can start a chat from the Users tab, and users can
see and reply to admin messages in their Messages tab.

## New Tables

### admin_conversations
- `id` (uuid, PK)
- `admin_id` (uuid, FK to profiles) — the admin who started the conversation
- `user_id` (uuid, FK to profiles) — the user being messaged
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, auto-updated via trigger)
- Unique constraint on (admin_id, user_id) — one conversation per admin-user pair

### admin_messages
- `id` (uuid, PK)
- `conversation_id` (uuid, FK to admin_conversations, ON DELETE CASCADE)
- `sender_id` (uuid, FK to profiles) — who sent the message
- `body` (text, NOT NULL)
- `read_at` (timestamptz, nullable — null means unread)
- `created_at` (timestamptz, default now())

## Security (RLS)
- admin_conversations: admin and user can SELECT; only admin can INSERT; both can UPDATE
- admin_messages: admin and user can SELECT; both can INSERT; both can UPDATE
- DELETE: only admin can delete conversations

## Notes
1. One conversation per admin-user pair (unique constraint)
2. Realtime via postgres_changes on both tables
3. Users see admin messages in their existing Messages tab
*/

CREATE TABLE IF NOT EXISTS admin_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_conversations_admin_user
  ON admin_conversations(admin_id, user_id);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_user_id ON admin_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_admin_id ON admin_conversations(admin_id);

ALTER TABLE admin_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_conversations_select" ON admin_conversations;
CREATE POLICY "admin_conversations_select" ON admin_conversations FOR SELECT
  TO authenticated USING (auth.uid() = admin_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_conversations_insert" ON admin_conversations;
CREATE POLICY "admin_conversations_insert" ON admin_conversations FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = admin_id
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_conversations_update" ON admin_conversations;
CREATE POLICY "admin_conversations_update" ON admin_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = admin_id OR auth.uid() = user_id)
  WITH CHECK (auth.uid() = admin_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_conversations_delete" ON admin_conversations;
CREATE POLICY "admin_conversations_delete" ON admin_conversations FOR DELETE
  TO authenticated USING (auth.uid() = admin_id);

CREATE TABLE IF NOT EXISTS admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation_id ON admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_sender_id ON admin_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at ON admin_messages(created_at);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_messages_select" ON admin_messages;
CREATE POLICY "admin_messages_select" ON admin_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM admin_conversations
      WHERE admin_conversations.id = admin_messages.conversation_id
      AND (auth.uid() = admin_conversations.admin_id OR auth.uid() = admin_conversations.user_id)
    )
  );

DROP POLICY IF EXISTS "admin_messages_insert" ON admin_messages;
CREATE POLICY "admin_messages_insert" ON admin_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM admin_conversations
      WHERE admin_conversations.id = admin_messages.conversation_id
      AND (auth.uid() = admin_conversations.admin_id OR auth.uid() = admin_conversations.user_id)
    )
  );

DROP POLICY IF EXISTS "admin_messages_update" ON admin_messages;
CREATE POLICY "admin_messages_update" ON admin_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_conversations
      WHERE admin_conversations.id = admin_messages.conversation_id
      AND (auth.uid() = admin_conversations.admin_id OR auth.uid() = admin_conversations.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_conversations
      WHERE admin_conversations.id = admin_messages.conversation_id
      AND (auth.uid() = admin_conversations.admin_id OR auth.uid() = admin_conversations.user_id)
    )
  );

CREATE OR REPLACE FUNCTION update_admin_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_conversations_updated ON admin_conversations;
CREATE TRIGGER trigger_admin_conversations_updated BEFORE UPDATE ON admin_conversations
  FOR EACH ROW EXECUTE FUNCTION update_admin_conversations_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE admin_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
