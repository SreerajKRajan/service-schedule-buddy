-- Add GHL contact ID field to jobs table for linking to GoHighLevel profiles
ALTER TABLE public.jobs 
ADD COLUMN ghl_contact_id text;

-- Add GHL contact ID field to accepted_quotes table as well
ALTER TABLE public.accepted_quotes 
ADD COLUMN ghl_contact_id text;

COMMENT ON COLUMN public.jobs.ghl_contact_id IS 'GoHighLevel contact ID for linking to customer profile';
COMMENT ON COLUMN public.accepted_quotes.ghl_contact_id IS 'GoHighLevel contact ID for linking to customer profile';