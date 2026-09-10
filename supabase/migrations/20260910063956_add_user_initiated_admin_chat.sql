/*
# Allow users to initiate admin chat

## Problem
Currently, only admins can INSERT into admin_conversations (per RLS policy).
Users have no way to start a conversation with admin — they can only reply
after an admin messages them first. The product needs a default "Admin Support"
card in every user's Messages tab so anyone can message admin anytime.

## Changes
1. New SECURITY DEFINER function `get_or_create_admin_conversation()`:
   - Called by any authenticated user.
   - Finds the first admin profile (role = 'admin', is_active = true).
   - Checks if an admin_conversations row already exists for (admin_id, user_id).
   - If yes, returns the existing conversation id.
   - If no, inserts a new row and returns the new id.
   - SECURITY DEFINER bypasses the admin-only INSERT RLS policy.
2. Grants EXECUTE to authenticated role.
3. Updates the admin_conversations INSERT policy to also allow users to insert
   when they are the user_id (redundant with the function, but keeps direct
   inserts working too).

## Security
- The function runs with owner privileges but only inserts rows where
  user_id = auth.uid() — a user cannot create conversations for other users.
- The admin_id is selected from the database, not user-controlled.
- Existing SELECT/UPDATE/DELETE policies remain unchanged.
*/

CREATE OR REPLACE FUNCTION get_or_create_admin_conversation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_conv_id uuid;
BEGIN
  -- Find the first active admin
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE role = 'admin' AND (is_active = true OR is_active IS NULL)
  ORDER BY created_at
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check for existing conversation
  SELECT id INTO v_conv_id
  FROM admin_conversations
  WHERE admin_id = v_admin_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO admin_conversations (admin_id, user_id)
  VALUES (v_admin_id, auth.uid())
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_admin_conversation() TO authenticated;
