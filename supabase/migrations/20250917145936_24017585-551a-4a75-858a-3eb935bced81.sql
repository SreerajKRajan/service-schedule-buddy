-- Fix search_path for notify_service_due function
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
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;