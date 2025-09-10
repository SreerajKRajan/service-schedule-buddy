-- Create job_services relationship table to store services associated with each job
CREATE TABLE public.job_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_description TEXT,
  price NUMERIC,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, service_id)
);

-- Enable Row Level Security
ALTER TABLE public.job_services ENABLE ROW LEVEL SECURITY;

-- Create policies for job_services
CREATE POLICY "Public access to job_services" 
ON public.job_services 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_job_services_job_id ON public.job_services(job_id);
CREATE INDEX idx_job_services_service_id ON public.job_services(service_id);