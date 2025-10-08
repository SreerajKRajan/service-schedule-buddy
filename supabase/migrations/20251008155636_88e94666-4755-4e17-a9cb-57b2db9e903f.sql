-- Fix search path for get_jobs_by_assignee function
CREATE OR REPLACE FUNCTION public.get_jobs_by_assignee(p_user_id uuid)
 RETURNS SETOF jobs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT DISTINCT j.*
  FROM public.jobs j
  JOIN public.job_assignments ja ON ja.job_id = j.id
  WHERE ja.user_id = p_user_id
  ORDER BY j.created_at DESC;
$function$;