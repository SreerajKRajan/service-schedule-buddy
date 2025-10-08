-- Create RPC to fetch jobs assigned to a specific user (assignee)
-- Optional filters can be added later if needed
CREATE OR REPLACE FUNCTION public.get_jobs_by_assignee(
  p_user_id uuid
)
RETURNS SETOF public.jobs
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT j.*
  FROM public.jobs j
  JOIN public.job_assignments ja ON ja.job_id = j.id
  WHERE ja.user_id = p_user_id
  ORDER BY j.created_at DESC;
$$;