import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import moment from 'https://esm.sh/moment-timezone@0.5.48';

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
  total_sales: number;
  job_types: string[];
  previous_week_job_count: number;
  trend: 'up' | 'down' | 'same';
  trend_percentage: number;
  daily_breakdown: Array<{
    date: string;
    job_count: number;
    sales_amount: number;
  }>;
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
    const sortBy = url.searchParams.get('sort_by') || 'job_count';
    const sortOrder = url.searchParams.get('sort_order') || 'desc';
    const technicianId = url.searchParams.get('technician_id');
    const jobType = url.searchParams.get('job_type');
    const includeTrends = url.searchParams.get('include_trends') !== 'false';
    const includeDailyBreakdown = url.searchParams.get('include_daily_breakdown') !== 'false';

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

    // Build query for current week jobs
    let jobsQuery = supabase
      .from('jobs')
      .select(`
        id,
        scheduled_date,
        estimated_duration,
        job_type,
        status,
        price,
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

    // Apply filters
    if (technicianId) {
      jobsQuery = jobsQuery.eq('job_assignments.user_id', technicianId);
    }
    if (jobType) {
      jobsQuery = jobsQuery.eq('job_type', jobType);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      throw jobsError;
    }

    console.log(`Found ${jobs?.length || 0} jobs with assignments`);

    // Fetch previous week data if trends requested
    let previousWeekJobs: any[] = [];
    if (includeTrends) {
      const prevStartDate = new Date(startDateTime.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevEndDate = startDateTime;

      let prevJobsQuery = supabase
        .from('jobs')
        .select(`
          id,
          job_assignments!inner(
            user_id,
            users!inner(
              id,
              role
            )
          )
        `)
        .gte('scheduled_date', prevStartDate.toISOString())
        .lt('scheduled_date', prevEndDate.toISOString())
        .not('scheduled_date', 'is', null)
        .not('status', 'in', '(completed,cancelled)');

      if (technicianId) {
        prevJobsQuery = prevJobsQuery.eq('job_assignments.user_id', technicianId);
      }
      if (jobType) {
        prevJobsQuery = prevJobsQuery.eq('job_type', jobType);
      }

      const { data: prevJobs } = await prevJobsQuery;
      previousWeekJobs = prevJobs || [];
    }

    // Process and aggregate data by technician
    const technicianMap = new Map<string, {
      id: string;
      name: string;
      jobs: Array<{ scheduled_date: string; estimated_duration: number; job_type: string; price: number }>;
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
            job_type: job.job_type,
            price: job.price || 0
          });
        }
      });
    });

    // Calculate previous week job counts
    const previousWeekMap = new Map<string, number>();
    if (includeTrends) {
      previousWeekJobs.forEach((job: any) => {
        job.job_assignments?.forEach((assignment: any) => {
          const user = assignment.users;
          if (user && user.role === 'worker') {
            previousWeekMap.set(user.id, (previousWeekMap.get(user.id) || 0) + 1);
          }
        });
      });
    }

    // Transform to response format
    const technicians: TechnicianSchedule[] = Array.from(technicianMap.values()).map(tech => {
      const sortedJobs = tech.jobs.sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );
      
      const jobTypes = [...new Set(tech.jobs.map(j => j.job_type))];
      const totalHours = tech.jobs.reduce((sum, j) => sum + j.estimated_duration, 0);
      const totalSales = tech.jobs.reduce((sum, j) => sum + j.price, 0);

      // Calculate trend
      const currentCount = tech.jobs.length;
      const previousCount = previousWeekMap.get(tech.id) || 0;
      const trendPercentage = previousCount > 0 
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : (currentCount > 0 ? 100 : 0);
      const trend = currentCount > previousCount ? 'up' 
        : currentCount < previousCount ? 'down' 
        : 'same';

      // Generate daily breakdown in America/Chicago timezone
      const dailyBreakdown: Array<{ date: string; job_count: number; sales_amount: number }> = [];
      if (includeDailyBreakdown) {
        const timezone = 'America/Chicago';
        const startMoment = moment.tz(startDateTime, timezone);
        
        for (let i = 0; i < 7; i++) {
          const dateMoment = startMoment.clone().add(i, 'days');
          const dateStr = dateMoment.format('YYYY-MM-DD');
          
          const jobsOnDate = tech.jobs.filter(job => {
            const jobDateStr = moment.parseZone(job.scheduled_date).tz(timezone, true).format('YYYY-MM-DD');
            return jobDateStr === dateStr;
          });
          const salesOnDate = jobsOnDate.reduce((sum, job) => sum + job.price, 0);
          dailyBreakdown.push({
            date: dateStr,
            job_count: jobsOnDate.length,
            sales_amount: salesOnDate
          });
        }
      }

      return {
        id: tech.id,
        name: tech.name,
        job_count: tech.jobs.length,
        earliest_scheduled_date: sortedJobs[0]?.scheduled_date || null,
        total_hours: Math.round(totalHours / 60), // Convert minutes to hours
        total_sales: totalSales,
        job_types: jobTypes,
        previous_week_job_count: previousCount,
        trend,
        trend_percentage: trendPercentage,
        daily_breakdown: dailyBreakdown
      };
    });

    // Apply backend sorting
    technicians.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'job_count') {
        comparison = a.job_count - b.job_count;
      } else if (sortBy === 'earliest_date') {
        const dateA = a.earliest_scheduled_date ? new Date(a.earliest_scheduled_date).getTime() : Infinity;
        const dateB = b.earliest_scheduled_date ? new Date(b.earliest_scheduled_date).getTime() : Infinity;
        comparison = dateA - dateB;
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

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
