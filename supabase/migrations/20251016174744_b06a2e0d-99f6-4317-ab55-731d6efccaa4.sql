-- Remove unique constraint on services name to allow duplicate service names
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_name_key;