-- Create table for accepted quotes from webhook
CREATE TABLE public.accepted_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  quoted_by UUID REFERENCES public.users(id),
  jobs_selected JSONB NOT NULL, -- Array of selected services/jobs
  first_time BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', -- pending, converted, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accepted_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public access to accepted_quotes" 
ON public.accepted_quotes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_accepted_quotes_updated_at
BEFORE UPDATE ON public.accepted_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();