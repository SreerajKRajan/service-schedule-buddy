-- Add appointment_id to accepted_quotes table
ALTER TABLE public.accepted_quotes 
ADD COLUMN appointment_id text;

-- Add appointment_id to jobs table
ALTER TABLE public.jobs 
ADD COLUMN appointment_id text;

-- Create indexes for faster lookups
CREATE INDEX idx_accepted_quotes_appointment_id ON public.accepted_quotes(appointment_id);
CREATE INDEX idx_jobs_appointment_id ON public.jobs(appointment_id);