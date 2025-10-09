import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Clock, CheckCircle } from "lucide-react";

interface DashboardStats {
  totalJobs: number;
  pendingJobs: number;
  onTheWayJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  totalUsers: number;
  jobsDueToday: number;
}

interface DashboardProps {
  customerEmail?: string | null;
  enabled?: boolean;
}

export function Dashboard({ customerEmail, enabled = true }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    pendingJobs: 0,
    onTheWayJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
    totalUsers: 0,
    jobsDueToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    fetchDashboardStats();
  }, [customerEmail, enabled]);

  const fetchDashboardStats = async () => {
    try {
      // Update overdue jobs to service_due status first
      await supabase.rpc('update_overdue_jobs');
      
      // Fetch job stats with email filter if provided
      let jobs: any[] = [];
      
      if (customerEmail) {
        let hasUserMatch = false;
        let jobIds: string[] = [];
        
        // 1) Try to resolve to a team member by email (case-insensitive)
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id')
          .ilike('email', customerEmail)
          .maybeSingle();
        
        if (userByEmail?.id) {
          hasUserMatch = true;
          const { data: assignments } = await supabase
            .from('job_assignments')
            .select('job_id')
            .eq('user_id', userByEmail.id);
          jobIds = assignments?.map(a => a.job_id) || [];
        } else {
          // 2) Fallback: try by name (for teams without stored emails)
          const { data: userByName } = await supabase
            .from('users')
            .select('id')
            .eq('name', customerEmail)
            .maybeSingle();
          if (userByName?.id) {
            hasUserMatch = true;
            const { data: assignmentsName } = await supabase
              .from('job_assignments')
              .select('job_id')
              .eq('user_id', userByName.id);
            jobIds = assignmentsName?.map(a => a.job_id) || [];
          }
        }
        
        if (hasUserMatch) {
          if (jobIds.length > 0) {
            const { data: jobsData } = await supabase
              .from('jobs')
              .select('status, scheduled_date, customer_email')
              .in('id', jobIds);
            jobs = jobsData || [];
          } else {
            jobs = [];
          }
        } else {
          // Final fallback: treat as customer email view
          const { data: jobsData } = await supabase
            .from('jobs')
            .select('status, scheduled_date, customer_email')
            .eq('customer_email', customerEmail);
          jobs = jobsData || [];
        }
      } else {
        const { data: jobsData } = await supabase.from('jobs').select('status, scheduled_date, customer_email');
        jobs = jobsData || [];
      }
      console.log('Dashboard filter debug', { customerEmail, jobsCount: jobs.length });
      const { data: users } = await supabase.from('users').select('id');

      if (jobs && users) {
        const today = new Date().toISOString().split('T')[0];
        const jobsDueToday = jobs.filter(job => 
          job.scheduled_date && job.scheduled_date.startsWith(today)
        ).length;

        setStats({
          totalJobs: jobs.length,
          pendingJobs: jobs.filter(job => job.status === 'pending').length,
          onTheWayJobs: jobs.filter(job => job.status === 'on_the_way').length,
          inProgressJobs: jobs.filter(job => job.status === 'in_progress').length,
          completedJobs: jobs.filter(job => job.status === 'completed').length,
          totalUsers: users.length,
          jobsDueToday,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
              <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse w-16 mb-1"></div>
              <div className="h-3 bg-muted rounded animate-pulse w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground">All time jobs created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingJobs}</div>
            <p className="text-xs text-muted-foreground">Awaiting assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On the Way</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.onTheWayJobs}</div>
            <p className="text-xs text-muted-foreground">En route to location</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgressJobs}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.jobsDueToday}</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Overview</CardTitle>
          <CardDescription>
            Current status of your service jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Job Status Distribution</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {stats.pendingJobs} Pending
            </Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              {stats.onTheWayJobs} On the Way
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {stats.inProgressJobs} In Progress
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {stats.completedJobs} Completed
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}