import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TechnicianSchedule {
  id: string;
  name: string;
  job_count: number;
  earliest_scheduled_date: string | null;
  total_hours: number;
  job_types: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get query parameters
    const url = new URL(req.url);
    const daysAhead = parseInt(url.searchParams.get('days_ahead') || '7');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    console.log(`Fetching technician schedules for next ${daysAhead} days`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date range
    const now = new Date();
    const startDateTime = startDate ? new Date(startDate) : now;
    const endDateTime = endDate 
      ? new Date(endDate) 
      : new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    console.log(`Date range: ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`);

    // Fetch jobs with assignments
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        scheduled_date,
        estimated_duration,
        job_type,
        status,
        job_assignments!inner(
          user_id,
          users!inner(
            id,
            name,
            role
          )
        )
      `)
      .gte('scheduled_date', startDateTime.toISOString())
      .lte('scheduled_date', endDateTime.toISOString())
      .not('scheduled_date', 'is', null)
      .not('status', 'in', '(completed,cancelled)');

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      throw jobsError;
    }

    console.log(`Found ${jobs?.length || 0} jobs with assignments`);

    // Process and aggregate data by technician
    const technicianMap = new Map<string, {
      id: string;
      name: string;
      jobs: Array<{ scheduled_date: string; estimated_duration: number; job_type: string }>;
    }>();

    jobs?.forEach((job: any) => {
      job.job_assignments?.forEach((assignment: any) => {
        const user = assignment.users;
        if (user && user.role === 'worker') {
          if (!technicianMap.has(user.id)) {
            technicianMap.set(user.id, {
              id: user.id,
              name: user.name,
              jobs: []
            });
          }
          technicianMap.get(user.id)!.jobs.push({
            scheduled_date: job.scheduled_date,
            estimated_duration: job.estimated_duration || 0,
            job_type: job.job_type
          });
        }
      });
    });

    // Transform to response format
    const technicians: TechnicianSchedule[] = Array.from(technicianMap.values()).map(tech => {
      const sortedJobs = tech.jobs.sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );
      
      const jobTypes = [...new Set(tech.jobs.map(j => j.job_type))];
      const totalHours = tech.jobs.reduce((sum, j) => sum + j.estimated_duration, 0);

      return {
        id: tech.id,
        name: tech.name,
        job_count: tech.jobs.length,
        earliest_scheduled_date: sortedJobs[0]?.scheduled_date || null,
        total_hours: Math.round(totalHours / 60), // Convert minutes to hours
        job_types: jobTypes
      };
    }).sort((a, b) => b.job_count - a.job_count);

    const response = {
      technicians,
      summary: {
        total_technicians: technicians.length,
        total_jobs: technicians.reduce((sum, t) => sum + t.job_count, 0),
        date_range: {
          start: startDateTime.toISOString().split('T')[0],
          end: endDateTime.toISOString().split('T')[0]
        }
      }
    };

    console.log(`Returning ${technicians.length} technicians with ${response.summary.total_jobs} total jobs`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in technician-schedule function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
