-- Create function to update overdue pending jobs to service_due
CREATE OR REPLACE FUNCTION public.update_overdue_jobs()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.jobs 
  SET status = 'service_due'::job_status,
      updated_at = now()
  WHERE status = 'pending'::job_status 
    AND scheduled_date IS NOT NULL
    AND DATE(scheduled_date) <= CURRENT_DATE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;