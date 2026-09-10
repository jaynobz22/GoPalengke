/*
# Allow image messages in chat

1. Purpose
- Update the messages table validation so chat photo messages can be saved.
- Preserve all existing text and video call messages.

2. Modified Tables
- `messages`
- Update the existing `messages_message_type_check` constraint.
- Allow `message_type` values `text`, `video_call`, and `image`.

3. Security
- No RLS policies, grants, or ownership rules are changed.
- Existing access controls on the messages table remain in place.

4. Data Safety Notes
- No rows are deleted or changed.
- No columns, tables, or data types are removed or renamed.
*/

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'video_call', 'image'));
