-- Add first_time column to jobs table
ALTER TABLE public.jobs 
ADD COLUMN first_time boolean DEFAULT false;