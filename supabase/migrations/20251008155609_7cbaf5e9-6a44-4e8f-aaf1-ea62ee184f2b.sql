-- Fix get_jobs_by_assignee to return distinct jobs only
CREATE OR REPLACE FUNCTION public.get_jobs_by_assignee(p_user_id uuid)
 RETURNS SETOF jobs
 LANGUAGE sql
AS $function$
  SELECT DISTINCT j.*
  FROM public.jobs j
  JOIN public.job_assignments ja ON ja.job_id = j.id
  WHERE ja.user_id = p_user_id
  ORDER BY j.created_at DESC;
$function$;