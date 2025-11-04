-- Remove unique constraint to allow duplicate services per job
ALTER TABLE public.job_services
  DROP CONSTRAINT IF EXISTS job_services_job_id_service_id_key;