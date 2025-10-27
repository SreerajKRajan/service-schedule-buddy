-- Unschedule the existing cron job
SELECT cron.unschedule('update-confirmed-to-service-due');

-- Schedule the new cron job to run every 15 minutes
SELECT cron.schedule(
  'update-confirmed-to-service-due',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/update-confirmed-to-service-due',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZWx4c21ycGJzd21tYWh3enlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjE3NDYsImV4cCI6MjA3MTE5Nzc0Nn0.981dxY5-6qnoQFM6hRtiFtOKbfCtyhV-r1_5eX8s2pQ"}'::jsonb
  ) as request_id;
  $$
);