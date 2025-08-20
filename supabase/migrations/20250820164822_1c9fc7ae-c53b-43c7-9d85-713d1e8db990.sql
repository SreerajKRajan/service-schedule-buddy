-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to run webhook notifications every 15 minutes
SELECT cron.schedule(
  'job-webhook-notifications',
  '*/15 * * * *', -- every 15 minutes
  $$
  select
    net.http_post(
        url:='https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/job-webhook-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZWx4c21ycGJzd21tYWh3enlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjE3NDYsImV4cCI6MjA3MTE5Nzc0Nn0.981dxY5-6qnoQFM6hRtiFtOKbfCtyhV-r1_5eX8s2pQ"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);