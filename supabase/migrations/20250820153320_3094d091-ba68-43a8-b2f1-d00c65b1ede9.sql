-- Add scheduled_date column to accepted_quotes table
ALTER TABLE public.accepted_quotes 
ADD COLUMN scheduled_date TIMESTAMP WITH TIME ZONE;