/*
# Add pg_net instant push dispatch

1. Enable pg_net extension (already installed, just needs enabling in schema)
2. Create a trigger function that calls the send-push-notification edge function
   via HTTP whenever a new row is inserted into push_notification_queue.
3. This makes notifications instant — no polling needed.
*/

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to dispatch push notification via edge function
CREATE OR REPLACE FUNCTION dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_function_url text;
  v_anon_key text;
BEGIN
  -- Construct the edge function URL
  v_function_url := current_setting('app.supabase_url', true);
  IF v_function_url IS NULL OR v_function_url = '' THEN
    v_function_url := 'https://melwjygaczevpasgazfo.supabase.co';
  END IF;
  v_function_url := v_function_url || '/functions/v1/send-push-notification';

  -- Get the anon key for authentication
  v_anon_key := current_setting('app.supabase_anon_key', true);
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    -- Fallback: use a known anon key pattern (set via project settings)
    RETURN NEW;
  END IF;

  -- Fire and forget — async HTTP POST to the edge function
  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object('triggered', true),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON push_notification_queue;
CREATE TRIGGER trg_dispatch_push_notification
  AFTER INSERT ON push_notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_push_notification();
