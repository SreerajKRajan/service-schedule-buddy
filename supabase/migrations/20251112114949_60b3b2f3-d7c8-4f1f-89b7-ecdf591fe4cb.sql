-- Fix search_path security warning for the trigger function
CREATE OR REPLACE FUNCTION prevent_completed_job_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the job is currently completed and the status is being changed
  IF OLD.status = 'completed' AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Cannot change status of a completed job. Job ID: %', OLD.id
      USING HINT = 'Completed jobs are locked and cannot be reopened or changed.',
            ERRCODE = 'P0001';
  END IF;
  
  -- Allow the update if not changing completed status
  RETURN NEW;
END;
$$;