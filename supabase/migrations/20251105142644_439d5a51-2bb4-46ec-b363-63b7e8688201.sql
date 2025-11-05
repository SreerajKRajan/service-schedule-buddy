-- Create appointments table for external calendar appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL,
  location_id TEXT,
  address TEXT,
  title TEXT NOT NULL,
  calendar_id TEXT,
  contact_id TEXT,
  group_id TEXT,
  appointment_status TEXT DEFAULT 'confirmed',
  assigned_user_id UUID REFERENCES public.users(id),
  assigned_users UUID[] DEFAULT '{}',
  notes TEXT,
  source TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_id)
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching your existing pattern)
CREATE POLICY "Public access to appointments"
ON public.appointments
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_assigned_user_id ON public.appointments(assigned_user_id);
CREATE INDEX idx_appointments_external_id ON public.appointments(external_id);