/*
# Update push dispatch to read anon key from vault

Update the dispatch_push_notification function to read the anon key
from the vault.secrets table instead of database settings.
*/

CREATE OR REPLACE FUNCTION dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_function_url text;
  v_anon_key text;
BEGIN
  v_function_url := 'https://melwjygaczevpasgazfo.supabase.co/functions/v1/send-push-notification';

  -- Read anon key from vault
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY_FOR_PUSH'
  LIMIT 1;

  IF v_anon_key IS NULL THEN
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
