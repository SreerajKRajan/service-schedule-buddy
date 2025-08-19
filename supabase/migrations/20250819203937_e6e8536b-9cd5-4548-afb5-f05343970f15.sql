-- Remove authentication requirements from all tables
-- Make all tables publicly accessible

-- Drop existing RLS policies that require authentication
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view basic user info" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Only authenticated users can insert users" ON public.users;

DROP POLICY IF EXISTS "Authenticated users can manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can manage job_assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "Authenticated users can manage job_schedules" ON public.job_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage services" ON public.services;

-- Create public access policies for all tables
CREATE POLICY "Public access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to job_assignments" ON public.job_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to job_schedules" ON public.job_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access to services" ON public.services FOR ALL USING (true) WITH CHECK (true);