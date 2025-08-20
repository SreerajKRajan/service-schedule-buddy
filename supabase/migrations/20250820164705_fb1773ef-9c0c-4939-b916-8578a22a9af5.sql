-- Add column to track webhook notifications
ALTER TABLE public.jobs 
ADD COLUMN webhook_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying
CREATE INDEX idx_jobs_webhook_scheduled ON public.jobs(scheduled_date, webhook_sent_at) 
WHERE scheduled_date IS NOT NULL;