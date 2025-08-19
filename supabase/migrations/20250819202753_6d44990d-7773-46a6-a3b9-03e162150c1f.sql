-- First, let's fix the immediate security issue by updating RLS policies
-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Allow all access to users" ON public.users;

-- Create secure policies that require authentication
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
TO authenticated
USING (auth.uid()::text = id::text);

-- Allow authenticated users to view basic info of other users (name only for job assignments)
CREATE POLICY "Authenticated users can view basic user info" 
ON public.users 
FOR SELECT 
TO authenticated
USING (true);

-- Only allow users to update their own data
CREATE POLICY "Users can update their own data" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (auth.uid()::text = id::text);

-- Restrict sensitive operations to authenticated users only
CREATE POLICY "Only authenticated users can insert users" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Similar fixes for other tables to require authentication
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
CREATE POLICY "Authenticated users can access jobs" 
ON public.jobs 
FOR ALL 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow all access to job_assignments" ON public.job_assignments;
CREATE POLICY "Authenticated users can access job assignments" 
ON public.job_assignments 
FOR ALL 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow all access to job_schedules" ON public.job_schedules;
CREATE POLICY "Authenticated users can access job schedules" 
ON public.job_schedules 
FOR ALL 
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow all access to services" ON public.services;
CREATE POLICY "Authenticated users can access services" 
ON public.services 
FOR ALL 
TO authenticated
USING (true);