/*
# Enable realtime for call_signals table

1. Purpose
- The video call signaling layer uses the `call_signals` table to exchange
  WebRTC offers, answers, and ICE candidates between two peers.
- This table was missing from the `supabase_realtime` publication, so the
  realtime subscription in the VideoCall component never received new rows.
  The app fell back to 800ms polling, which was unreliable and caused calls
  to fail to connect.
- Adding `call_signals` to the realtime publication ensures instant delivery
  of signaling messages.

2. Modified Tables
- `call_signals` — added to `supabase_realtime` publication for INSERT events.

3. Security
- No RLS policies or grants are changed.
- The table already has proper RLS: authenticated users can only insert and
  delete their own signals, and all authenticated users can read signals
  for call coordination.

4. Data Safety Notes
- No rows are deleted or changed.
- No columns, tables, or data types are removed or renamed.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
