-- Add price field to jobs table
ALTER TABLE public.jobs ADD COLUMN price DECIMAL(10,2);

-- Create function to calculate next due date for recurring jobs
CREATE OR REPLACE FUNCTION public.calculate_next_due_date(
  last_date TIMESTAMP WITH TIME ZONE,
  frequency_type public.frequency_type,
  interval_val INTEGER DEFAULT 1
) RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
BEGIN
  CASE frequency_type
    WHEN 'daily' THEN
      RETURN last_date + (interval_val || ' days')::INTERVAL;
    WHEN 'weekly' THEN
      RETURN last_date + (interval_val || ' weeks')::INTERVAL;
    WHEN 'monthly' THEN
      RETURN last_date + (interval_val || ' months')::INTERVAL;
    WHEN 'yearly' THEN
      RETURN last_date + (interval_val || ' years')::INTERVAL;
    ELSE
      RETURN last_date;
  END CASE;
END;
$$;

-- Create function to update next due dates for completed recurring jobs
CREATE OR REPLACE FUNCTION public.update_recurring_job_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  schedule_record RECORD;
BEGIN
  -- Only process if job status changed to completed and job is recurring
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.is_recurring = true THEN
    -- Get the job schedule
    SELECT * INTO schedule_record 
    FROM public.job_schedules 
    WHERE job_id = NEW.id AND is_active = true;
    
    IF FOUND THEN
      -- Update next due date
      UPDATE public.job_schedules 
      SET next_due_date = public.calculate_next_due_date(
        COALESCE(NEW.completed_date, now()),
        schedule_record.frequency,
        schedule_record.interval_value
      )
      WHERE job_id = NEW.id AND is_active = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update recurring job schedules
CREATE TRIGGER update_recurring_schedule_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recurring_job_schedule();