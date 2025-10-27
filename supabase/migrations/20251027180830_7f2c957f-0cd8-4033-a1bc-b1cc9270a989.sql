-- Add 'confirmed' to job_status enum
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'confirmed';

-- Create function to update confirmed jobs to service_due when scheduled date has passed
CREATE OR REPLACE FUNCTION public.update_confirmed_jobs_to_service_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.jobs 
  SET status = 'service_due'::job_status,
      updated_at = now()
  WHERE status = 'confirmed'::job_status 
    AND scheduled_date IS NOT NULL
    AND DATE(scheduled_date) <= CURRENT_DATE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

-- Schedule cron job to run every 15 minutes
SELECT cron.schedule(
  'update-confirmed-to-service-due',
  '*/15 * * * *',
  $$
  SELECT public.update_confirmed_jobs_to_service_due();
  $$
);