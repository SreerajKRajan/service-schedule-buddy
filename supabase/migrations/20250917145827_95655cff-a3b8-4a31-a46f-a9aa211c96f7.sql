-- Create function to call service due webhook
CREATE OR REPLACE FUNCTION public.notify_service_due()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
BEGIN
  -- Only trigger when status changes TO service_due
  IF NEW.status = 'service_due' AND (OLD.status IS NULL OR OLD.status != 'service_due') THEN
    
    -- Get the webhook URL from environment or use direct URL
    webhook_url := 'https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/service-due-webhook';
    
    -- Call the edge function asynchronously using pg_net
    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('jobId', NEW.id::text)
    );
    
    -- Log the webhook trigger
    INSERT INTO public.webhook_logs (job_id, webhook_type, triggered_at)
    VALUES (NEW.id, 'service_due', now())
    ON CONFLICT DO NOTHING;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create webhook logs table for tracking
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  webhook_type TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(job_id, webhook_type)
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for webhook_logs
CREATE POLICY "Public access to webhook_logs" ON public.webhook_logs
FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for service due notifications
DROP TRIGGER IF EXISTS trigger_service_due_webhook ON public.jobs;
CREATE TRIGGER trigger_service_due_webhook
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_due();