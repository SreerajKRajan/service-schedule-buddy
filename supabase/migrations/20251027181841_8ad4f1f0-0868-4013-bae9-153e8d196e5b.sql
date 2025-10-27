-- Update the cron job to run every 1 minute instead of 15 minutes
SELECT cron.unschedule('update-confirmed-to-service-due');

SELECT cron.schedule(
  'update-confirmed-to-service-due',
  '* * * * *', -- Every minute
  $$
  SELECT public.update_confirmed_jobs_to_service_due();
  $$
);