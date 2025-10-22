-- Step 1: Delete duplicate job_assignments and job_services for duplicate jobs
-- First identify the job IDs to delete (duplicates)
WITH duplicate_jobs AS (
  SELECT id, scheduled_date, customer_email, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY customer_email, scheduled_date 
      ORDER BY created_at ASC
    ) as row_num
  FROM jobs
  WHERE customer_email IN ('wendeebenedettini@yahoo.com', 'Marcus.Moxley@elitemh.com')
    AND is_recurring = true
),
jobs_to_delete AS (
  SELECT id FROM duplicate_jobs WHERE row_num > 1
)
-- Delete from job_services first (foreign key dependency)
DELETE FROM job_services 
WHERE job_id IN (SELECT id FROM jobs_to_delete);

-- Step 2: Delete from job_assignments
WITH duplicate_jobs AS (
  SELECT id, scheduled_date, customer_email, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY customer_email, scheduled_date 
      ORDER BY created_at ASC
    ) as row_num
  FROM jobs
  WHERE customer_email IN ('wendeebenedettini@yahoo.com', 'Marcus.Moxley@elitemh.com')
    AND is_recurring = true
),
jobs_to_delete AS (
  SELECT id FROM duplicate_jobs WHERE row_num > 1
)
DELETE FROM job_assignments 
WHERE job_id IN (SELECT id FROM jobs_to_delete);

-- Step 3: Delete duplicate jobs (keep only the first created for each scheduled_date per customer)
WITH duplicate_jobs AS (
  SELECT id, scheduled_date, customer_email, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY customer_email, scheduled_date 
      ORDER BY created_at ASC
    ) as row_num
  FROM jobs
  WHERE customer_email IN ('wendeebenedettini@yahoo.com', 'Marcus.Moxley@elitemh.com')
    AND is_recurring = true
)
DELETE FROM jobs 
WHERE id IN (
  SELECT id FROM duplicate_jobs WHERE row_num > 1
);

-- Step 4: Create a function to prevent updating quote status if already converted
CREATE OR REPLACE FUNCTION prevent_duplicate_quote_conversion()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to change status to 'converted' or 'converting'
  IF NEW.status IN ('converted', 'converting') THEN
    -- Check if old status was already 'converted'
    IF OLD.status = 'converted' THEN
      RAISE EXCEPTION 'Quote has already been converted. Cannot convert again.'
        USING HINT = 'This quote was previously converted to jobs.',
              ERRCODE = 'P0001';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger on accepted_quotes table
DROP TRIGGER IF EXISTS check_quote_conversion ON accepted_quotes;

CREATE TRIGGER check_quote_conversion
  BEFORE UPDATE ON accepted_quotes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_quote_conversion();

-- Step 6: Add comment to document the trigger
COMMENT ON TRIGGER check_quote_conversion ON accepted_quotes IS 
  'Prevents converting a quote that has already been converted to jobs';