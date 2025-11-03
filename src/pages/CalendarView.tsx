import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JobCalendar } from "@/components/JobCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateJobForm } from "@/components/CreateJobForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Search, Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface User {
  id: string;
  email: string;
  name: string;
}

interface JobAssignment {
  job_id: string;
  user_id: string;
}

interface Job {
  id: string;
  title: string;
  description: string;
  job_type: string;
  status: string;
  priority: number;
  estimated_duration: number;
  scheduled_date: string;
  completed_date: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  notes: string;
  is_recurring: boolean;
  first_time: boolean;
  created_at: string;
  updated_at: string;
  price: number;
  quoted_by?: string;
}

interface AcceptedQuote {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  scheduled_date: string;
  jobs_selected: any;
  status: string;
  first_time: boolean;
  quoted_by?: string;
  ghl_contact_id?: string;
  appointment_id?: string;
  created_at: string;
}

const CalendarView = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("id");
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createJobData, setCreateJobData] = useState<any>(null);
  const [hasFullAccess, setHasFullAccess] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    const userHasFullAccess = await fetchJobs();
    await Promise.all([fetchUsers(), fetchAcceptedQuotes(userHasFullAccess)]);
    setLoading(false);
  };

  const fetchJobs = async (): Promise<boolean> => {
    try {
      if (userId) {
        const { data: user } = await supabase
          .from("users")
          .select("id, role")
          .ilike("email", userId)
          .maybeSingle();

        if (!user) {
          setJobs([]);
          setHasFullAccess(false);
          return false;
        }

        // Check if user has full access based on their role
        const fullAccess = user.role === 'supervisor' || user.role === 'manager';
        setHasFullAccess(fullAccess);

        if (fullAccess) {
          // Fetch all jobs if user has full access (only with scheduled_date for calendar)
          const { data, error } = await supabase
            .from("jobs")
            .select("*")
            .not("scheduled_date", "is", null)
            .order("scheduled_date", { ascending: true })
            .limit(10000);

          if (error) throw error;
          setJobs(data || []);
          return true;
        }

        // Use a join query to fetch only assigned jobs (with scheduled_date for calendar)
        const { data, error } = await supabase
          .from("jobs")
          .select("*, job_assignments!inner(user_id)")
          .eq("job_assignments.user_id", user.id)
          .not("scheduled_date", "is", null)
          .order("scheduled_date", { ascending: true })
          .limit(10000);

        if (error) throw error;
        
        // Ensure unique jobs by id
        const uniqueJobsMap = new Map<string, any>();
        (data || []).forEach((j: any) => {
          const id = j.id;
          if (id && !uniqueJobsMap.has(id)) uniqueJobsMap.set(id, j);
        });
        const jobsData = Array.from(uniqueJobsMap.values());
        
        setJobs(jobsData);
        return false;
      }

      // If no userId, fetch all jobs (only with scheduled_date for calendar)
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: true })
        .limit(10000);

      if (error) throw error;
      setJobs(data || []);
      setHasFullAccess(true);
      return true;
    } catch (error: any) {
      toast.error("Failed to fetch jobs");
      console.error("Error fetching jobs:", error);
      return false;
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchAcceptedQuotes = async (userHasFullAccess: boolean) => {
    try {
      // Only fetch accepted quotes if user has full access
      if (!userHasFullAccess && userId) {
        setAcceptedQuotes([]);
        return;
      }

      const { data, error } = await supabase
        .from("accepted_quotes")
        .select("*")
        .neq("status", "converted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAcceptedQuotes(data || []);
    } catch (error: any) {
      console.error("Error fetching accepted quotes:", error);
    }
  };

  const filterJobs = () => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.job_type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || statusFilter === "accepted_quotes" || job.status === statusFilter;
      const matchesType = typeFilter === "all" || job.job_type === typeFilter;

      // Date range filter
      if (dateRange?.from || dateRange?.to) {
        if (!job.scheduled_date) return false;

        const scheduledDate = new Date(job.scheduled_date);
        const scheduledDateOnly = new Date(
          scheduledDate.getFullYear(),
          scheduledDate.getMonth(),
          scheduledDate.getDate()
        );

        if (dateRange.from && dateRange.to) {
          const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
          const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
          if (scheduledDateOnly < fromDate || scheduledDateOnly > toDate) return false;
        } else if (dateRange.from) {
          const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
          if (scheduledDateOnly < fromDate) return false;
        } else if (dateRange.to) {
          const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
          if (scheduledDateOnly > toDate) return false;
        }
      }

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const handleConvertToJob = (quote: AcceptedQuote, onSuccess: () => void, onError: () => void) => {
    const jobsSelected = quote.jobs_selected || [];
    const serviceNames = jobsSelected.map((j: any) => j.service_name || j.name).join(", ");
    
    setCreateJobData({
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone,
      customer_email: quote.customer_email,
      customer_address: quote.customer_address,
      scheduled_date: quote.scheduled_date,
      first_time: quote.first_time,
      jobs_selected: quote.jobs_selected,
      ghl_contact_id: quote.ghl_contact_id,
      appointment_id: quote.appointment_id,
      quoted_by: quote.quoted_by,
    });
    setShowCreateForm(true);
  };

  const handleCreateJobSuccess = async () => {
    setShowCreateForm(false);
    setCreateJobData(null);
    await fetchData();
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">No user ID provided in URL</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  const filteredJobs = filterJobs();
  const jobTypes = [...new Set(jobs.map((job) => job.job_type).filter((type) => type && type.trim() !== ""))];

  return (
    <div className="min-h-screen p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search jobs, customers, or types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="service_due">Service Due</SelectItem>
                <SelectItem value="on_the_way">On the Way</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                {hasFullAccess && <SelectItem value="accepted_quotes">Accepted Quotes</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">All Types</SelectItem>
                {jobTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full md:w-[240px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-background" align="start">
                <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || dateRange) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setDateRange(undefined);
                }}
                className="h-8"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <JobCalendar
        jobs={filteredJobs}
        quotes={acceptedQuotes}
        hideAcceptedQuotes={!hasFullAccess}
        statusFilter={statusFilter}
        onRefresh={fetchData}
        onConvertToJob={handleConvertToJob}
      />

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <CreateJobForm
            onSuccess={handleCreateJobSuccess}
            onCancel={() => setShowCreateForm(false)}
            initialData={createJobData}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
