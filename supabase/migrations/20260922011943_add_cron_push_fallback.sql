/*
# Add pg_cron fallback for push notification processing

1. Schedule a cron job that calls the send-push-notification edge function
   every 1 minute as a fallback to catch any notifications that the
   real-time trigger might have missed.
*/

-- Grant pg_cron access to the service role
-- The cron job calls the edge function via net.http_post
SELECT cron.schedule(
  'process-push-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://melwjygaczevpasgazfo.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_ANON_KEY_FOR_PUSH' LIMIT 1
      )
    ),
    body := jsonb_build_object('cron', true),
    timeout_milliseconds := 10000
  );
  $$
);
