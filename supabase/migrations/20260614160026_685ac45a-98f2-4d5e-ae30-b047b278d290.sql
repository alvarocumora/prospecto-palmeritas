-- Catastro expirations: daily at 09:00 UTC
SELECT cron.unschedule('notify-catastro-expirations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-catastro-expirations');

SELECT cron.schedule(
  'notify-catastro-expirations',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4ff8283c-30b0-4202-a5f2-7e7e000a91a4.lovable.app/api/public/notifications/catastro-expirations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZmFidm5ibHJjcXVidmpyemt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTcwNDAsImV4cCI6MjA5MjA3MzA0MH0.rpD-tRDQ8LGMZLlTAGsxLo77ccx9SHOuXUA1qoWyjx4'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Satellite anomalies: hourly
SELECT cron.unschedule('notify-satellite-anomalies')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-satellite-anomalies');

SELECT cron.schedule(
  'notify-satellite-anomalies',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4ff8283c-30b0-4202-a5f2-7e7e000a91a4.lovable.app/api/public/notifications/satellite-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZmFidm5ibHJjcXVidmpyemt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTcwNDAsImV4cCI6MjA5MjA3MzA0MH0.rpD-tRDQ8LGMZLlTAGsxLo77ccx9SHOuXUA1qoWyjx4'
    ),
    body := '{}'::jsonb
  );
  $$
);