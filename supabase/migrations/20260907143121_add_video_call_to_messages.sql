-- Add video call support to messages table
-- message_type: 'text' (default) or 'video_call'
-- call_room_id: unique room ID for the WebRTC signaling channel
-- call_status: 'pending', 'accepted', 'declined', 'ended'

ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'video_call'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS call_room_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS call_status text
  CHECK (call_status IS NULL OR call_status IN ('pending', 'accepted', 'declined', 'ended'));
