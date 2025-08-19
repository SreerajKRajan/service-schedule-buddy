-- Create services table to manage job types/services
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_duration INTEGER, -- in hours
  default_price NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create policies for services access
CREATE POLICY "Allow all access to services" 
ON public.services 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default services based on existing job types
INSERT INTO public.services (name, description, default_duration, default_price) VALUES
('Gutter Cleaning', 'Professional gutter cleaning and maintenance', 2, 150.00),
('Landscaping', 'Garden maintenance and landscaping services', 4, 300.00),
('Window Cleaning', 'Interior and exterior window cleaning', 1, 80.00),
('Pressure Washing', 'High-pressure cleaning for driveways, patios, and exteriors', 3, 200.00),
('Lawn Care', 'Mowing, edging, and general lawn maintenance', 2, 120.00);