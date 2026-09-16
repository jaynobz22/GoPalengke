/*
# Seller Verification Welcome Message & Auto-Delete Images

## Purpose
When a new seller registers and logs in for the first time, they automatically
receive a pre-built message in their admin chat asking them to submit verification
photos (store picture, valid ID, selfie holding ID, business permit or farm photo).
The seller replies with images directly in the message section. When the admin
approves the seller, all verification images are automatically deleted from both
the database and storage to avoid bloating the database.

## Changes

### 1. New column on admin_messages: is_verification_image (boolean)
  - Marks messages that contain verification images sent by the seller.
  - Defaults to false. Only set to true for image messages sent by non-admin users
    in the seller verification flow.

### 2. New column on admin_conversations: welcome_sent_at (timestamptz, nullable)
  - Tracks whether the pre-built welcome/verification message has been sent to
    this conversation. Prevents duplicate welcome messages on repeated logins.

### 3. New SECURITY DEFINER function: send_seller_welcome_message(p_user_id uuid)
  - Idempotent: checks welcome_sent_at before sending.
  - Inserts a pre-built text message into admin_messages from the admin side.
  - Sets welcome_sent_at on the conversation.
  - Called by the frontend after get_or_create_admin_conversation for sellers.

### 4. New SECURITY DEFINER function: delete_seller_verification_images(p_user_id uuid)
  - Finds all admin_messages with is_verification_image = true for the user's
    conversations.
  - Deletes the image files from the chat-images storage bucket.
  - Deletes the message rows from admin_messages.
  - Called by a trigger when a seller's is_approved changes from false to true.

### 5. Trigger: auto_delete_verification_images_on_approval
  - AFTER UPDATE on profiles, when is_approved transitions to true AND role = 'seller'.
  - Calls delete_seller_verification_images with the seller's user id.

## Security
  - Functions run as SECURITY DEFINER to allow storage and cross-user access.
  - search_path set to public to prevent injection.
  - The trigger only fires for role = 'seller' and is_approved = true.
  - Verification images are scoped to the user's own conversations.
*/

-- 1. Add is_verification_image column to admin_messages
ALTER TABLE admin_messages
  ADD COLUMN IF NOT EXISTS is_verification_image boolean DEFAULT false;

-- 2. Add welcome_sent_at column to admin_conversations
ALTER TABLE admin_conversations
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

-- 3. Function: send pre-built welcome message to a new seller
CREATE OR REPLACE FUNCTION send_seller_welcome_message(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_admin_id uuid;
  v_welcome_text text;
BEGIN
  -- Get the admin conversation for this user
  SELECT id, admin_id INTO v_conv_id, v_admin_id
  FROM admin_conversations
  WHERE user_id = p_user_id
  ORDER BY created_at
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN;
  END IF;

  -- Already sent? Skip (idempotent)
  IF EXISTS (
    SELECT 1 FROM admin_conversations
    WHERE id = v_conv_id AND welcome_sent_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  v_welcome_text := 'Mabuhay sa GoPalengke! Para makumpleto ang verification mo bilang seller, mangyari magpadala ng mga sumusunod na larawan dito sa chat:' || E'\n\n' ||
    '1. Larawan ng tindahan mo (makikita ang mga paninda)' || E'\n' ||
    '2. Larawan ng Valid ID mo' || E'\n' ||
    '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n' ||
    '4. Business Permit sa palengke (kung may pwesto ka sa palengke)' || E'\n\n' ||
    'Kung wala kang pwesto sa palengke at may farm ka (gulayan, fishpond, manukan, o kahit anong farm), magpadala ng:' || E'\n\n' ||
    '1. Larawan ng farm mo' || E'\n' ||
    '2. Larawan ng Valid ID mo' || E'\n' ||
    '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n\n' ||
    'I-send o i-reply ang mga larawan dito mismo sa message section para ma-verify ka ng admin bago ka ma-approve bilang seller. Salamat!';

  -- Insert the welcome message from the admin
  INSERT INTO admin_messages (conversation_id, sender_id, body, image_url)
  VALUES (v_conv_id, v_admin_id, v_welcome_text, NULL);

  -- Mark welcome as sent
  UPDATE admin_conversations
  SET welcome_sent_at = now(), updated_at = now()
  WHERE id = v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_seller_welcome_message(uuid) TO authenticated;

-- 4. Function: delete all verification images for a seller
CREATE OR REPLACE FUNCTION delete_seller_verification_images(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg RECORD;
  v_path text;
BEGIN
  -- Find all verification image messages in this user's conversations
  FOR v_msg IN
    SELECT am.id, am.image_url
    FROM admin_messages am
    JOIN admin_conversations ac ON am.conversation_id = ac.id
    WHERE ac.user_id = p_user_id
      AND am.is_verification_image = true
      AND am.image_url IS NOT NULL
  LOOP
    -- Extract storage path from public URL
    v_path := substring(v_msg.image_url from 'chat-images/(.+)$');
    IF v_path IS NOT NULL AND v_path != '' THEN
      -- Delete from storage
      DELETE FROM storage.objects
      WHERE name = 'chat-images/' || v_path;
    END IF;
  END LOOP;

  -- Delete the verification message rows
  DELETE FROM admin_messages
  WHERE id IN (
    SELECT am.id
    FROM admin_messages am
    JOIN admin_conversations ac ON am.conversation_id = ac.id
    WHERE ac.user_id = p_user_id
      AND am.is_verification_image = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_seller_verification_images(uuid) TO authenticated;

-- 5. Trigger function: auto-delete verification images when seller is approved
CREATE OR REPLACE FUNCTION trigger_delete_verification_images()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM delete_seller_verification_images(NEW.id);
  RETURN NEW;
END;
$$;

-- 5b. Trigger: auto-delete verification images when seller is approved
DROP TRIGGER IF EXISTS auto_delete_verification_images_on_approval ON profiles;

CREATE TRIGGER auto_delete_verification_images_on_approval
  AFTER UPDATE OF is_approved ON profiles
  FOR EACH ROW
  WHEN (OLD.is_approved = false AND NEW.is_approved = true AND NEW.role = 'seller')
  EXECUTE FUNCTION trigger_delete_verification_images();
