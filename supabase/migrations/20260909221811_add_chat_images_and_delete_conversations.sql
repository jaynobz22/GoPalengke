-- ============= ADD IMAGE COLUMNS TO MESSAGES =============
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE messages ADD CONSTRAINT messages_body_or_image CHECK (body IS NOT NULL OR image_url IS NOT NULL);

ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE admin_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE admin_messages ADD CONSTRAINT admin_messages_body_or_image CHECK (body IS NOT NULL OR image_url IS NOT NULL);

-- ============= ADD DELETE POLICIES FOR CONVERSATIONS =============
DROP POLICY IF EXISTS "conversations_delete_participants" ON conversations;
CREATE POLICY "conversations_delete_participants" ON conversations FOR DELETE
  TO authenticated USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR auth.uid() = rider_id
  );

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "admin_conversations_delete_user" ON admin_conversations;
CREATE POLICY "admin_conversations_delete_user" ON admin_conversations FOR DELETE
  TO authenticated USING (auth.uid() = admin_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_messages_delete_sender" ON admin_messages;
CREATE POLICY admin_messages_delete_sender ON admin_messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

-- ============= CREATE CHAT-IMAGES STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_images_public_read" ON storage.objects;
CREATE POLICY "chat_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "chat_images_auth_insert" ON storage.objects;
CREATE POLICY "chat_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "chat_images_auth_delete" ON storage.objects;
CREATE POLICY "chat_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images');

-- ============= AUTO-DELETE OLD IMAGE MESSAGES =============
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_old_chat_images()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE image_url IS NOT NULL
  AND created_at < now() - interval '1 hour';

  DELETE FROM admin_messages
  WHERE image_url IS NOT NULL
  AND created_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-old-chat-images',
  '*/10 * * * *',
  $$SELECT delete_old_chat_images();$$
);
