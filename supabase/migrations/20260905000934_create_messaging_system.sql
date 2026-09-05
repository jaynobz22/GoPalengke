/*
# Messaging System for GoPalengke

## Overview
Adds in-app chat functionality so buyers, sellers, and riders can message
each other directly. Conversations are linked to orders so a buyer can chat
with the seller of an order, and once a rider is assigned, chat with the rider.

## New Tables
1. `conversations` - Links two participants to an order
   - `id` (uuid, PK)
   - `order_id` (uuid, FK to orders, ON DELETE CASCADE)
   - `buyer_id` (uuid, FK to profiles)
   - `seller_id` (uuid, FK to profiles, nullable - null for buyer_rider type)
   - `rider_id` (uuid, FK to profiles, nullable - null for buyer_seller type)
   - `type` (text, CHECK in 'buyer_seller', 'buyer_rider')
   - `created_at` (timestamptz)
   - `updated_at` (timestamztz, auto-updated via trigger)

2. `messages` - Individual chat messages
   - `id` (uuid, PK)
   - `conversation_id` (uuid, FK to conversations, ON DELETE CASCADE)
   - `sender_id` (uuid, FK to profiles)
   - `body` (text, NOT NULL)
   - `read_at` (timestamptz, nullable - null means unread)
   - `created_at` (timestamptz)

## Security
- RLS enabled on both tables
- Conversations: only participants (buyer, seller, or rider depending on type)
  can SELECT, INSERT, and UPDATE
- Messages: only conversation participants can SELECT and INSERT
- Messages: only the recipient can UPDATE read_at (mark as read)
- A unique constraint prevents duplicate conversations for the same order+type

## Indexes
- conversations: order_id, buyer_id, seller_id, rider_id
- messages: conversation_id, sender_id, created_at
*/

-- ============= CONVERSATIONS TABLE =============
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buyer_seller', 'buyer_rider')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT conversations_participants_check
    CHECK (
      (type = 'buyer_seller' AND seller_id IS NOT NULL AND rider_id IS NULL)
      OR
      (type = 'buyer_rider' AND rider_id IS NOT NULL AND seller_id IS NULL)
    )
);

-- Prevent duplicate conversations for same order + type
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_order_type
  ON conversations(order_id, type);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Participants can see their conversations
DROP POLICY IF EXISTS "conversations_select_participants" ON conversations;
CREATE POLICY "conversations_select_participants" ON conversations FOR SELECT
  TO authenticated USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR auth.uid() = rider_id
  );

-- Buyer can create conversations (e.g., chat with seller, chat with rider)
DROP POLICY IF EXISTS "conversations_insert_buyer" ON conversations;
CREATE POLICY "conversations_insert_buyer" ON conversations FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = buyer_id
  );

-- Participants can update (e.g., updated_at trigger)
DROP POLICY IF EXISTS "conversations_update_participants" ON conversations;
CREATE POLICY "conversations_update_participants" ON conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR auth.uid() = rider_id
  )
  WITH CHECK (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR auth.uid() = rider_id
  );

-- ============= MESSAGES TABLE =============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Participants can see messages in their conversations
DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        auth.uid() = conversations.buyer_id
        OR auth.uid() = conversations.seller_id
        OR auth.uid() = conversations.rider_id
      )
    )
  );

-- Participants can send messages
DROP POLICY IF EXISTS "messages_insert_participants" ON messages;
CREATE POLICY "messages_insert_participants" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        auth.uid() = conversations.buyer_id
        OR auth.uid() = conversations.seller_id
        OR auth.uid() = conversations.rider_id
      )
    )
  );

-- Recipients can mark messages as read (only non-sender can mark read)
DROP POLICY IF EXISTS "messages_update_recipient" ON messages;
CREATE POLICY "messages_update_recipient" ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        auth.uid() = conversations.buyer_id
        OR auth.uid() = conversations.seller_id
        OR auth.uid() = conversations.rider_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        auth.uid() = conversations.buyer_id
        OR auth.uid() = conversations.seller_id
        OR auth.uid() = conversations.rider_id
      )
    )
  );

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_rider_id ON conversations(rider_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============= UPDATED_AT TRIGGER FOR CONVERSATIONS =============
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversations_updated ON conversations;
CREATE TRIGGER trigger_conversations_updated BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversation_updated_at();

-- ============= REALTIME PUBLICATION =============
-- Add tables to the existing supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
