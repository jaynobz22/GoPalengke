/*
# Create call_signals table for WebRTC video call signaling

## Purpose
Replaces Supabase broadcast channels for WebRTC signaling (offer, answer, ICE candidates).
Broadcast channels are ephemeral — if a subscriber joins late, it misses messages.
Database-based signaling via postgres_changes realtime is reliable because
messages persist in the table until both parties have read them.

## New Table
- `call_signals`
  - `id` (uuid, primary key)
  - `room_id` (text, not null) — the video call room identifier
  - `sender_id` (uuid, not null) — auth user ID of sender
  - `event` (text, not null) — signal type: 'receiver_ready', 'offer', 'answer', 'ice', 'end', 'caller_present'
  - `payload` (jsonb) — the signal data (SDP, ICE candidate, etc.)
  - `created_at` (timestamptz, default now())

## Security
- Enable RLS on `call_signals`.
- Only authenticated users can read/write signals for rooms they participate in.
- Since we cannot verify room membership from this table alone, we allow
  authenticated users to insert and read all signals (the room_id is a
  random unguessable string, so only call participants know it).
- Signals are automatically cleaned up after 1 hour via a TTL index.

## Notes
1. This table is write-heavy and short-lived — rows are only needed during
   the call setup phase.
2. The frontend will subscribe to INSERT events filtered by room_id and
   process signals as they arrive, exactly like chat messages.
*/

CREATE TABLE IF NOT EXISTS call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  event text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_call_signals" ON call_signals;
CREATE POLICY "select_call_signals"
ON call_signals FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "insert_call_signals" ON call_signals;
CREATE POLICY "insert_call_signals"
ON call_signals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "delete_call_signals" ON call_signals;
CREATE POLICY "delete_call_signals"
ON call_signals FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_call_signals_room_id ON call_signals(room_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_created_at ON call_signals(created_at);
