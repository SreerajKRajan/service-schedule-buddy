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
import { Search, Filter, Calendar as CalendarIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([]);
  const [isUsersOpen, setIsUsersOpen] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  // Refetch jobs when assignee filters change to mirror JobBoard behavior
  useEffect(() => {
    const refetchWithFilter = async () => {
      if (userId && hasFullAccess) {
        setIsFilterLoading(true);
        await fetchJobs();
        setIsFilterLoading(false);
      }
    };
    refetchWithFilter();
  }, [selectedAssignees]);

  const fetchData = async () => {
    setLoading(true);
    const userHasFullAccess = await fetchJobs();
    await Promise.all([fetchUsers(), fetchAcceptedQuotes(userHasFullAccess), fetchJobAssignments()]);
    setLoading(false);
  };

  const fetchJobAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("job_assignments")
        .select("*");

      if (error) throw error;
      setJobAssignments(data || []);
    } catch (error: any) {
      console.error("Error fetching job assignments:", error);
    }
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
          let query = supabase
            .from("jobs")
            .select("*")
            .not("scheduled_date", "is", null)
            .order("scheduled_date", { ascending: true })
            .limit(10000);

          // If assignees are selected, mirror JobBoard behavior and filter at the API level
          if (selectedAssignees.length > 0) {
            query = supabase
              .from("jobs")
              .select("*, job_assignments!inner(user_id)")
              .in("job_assignments.user_id", selectedAssignees)
              .not("scheduled_date", "is", null)
              .order("scheduled_date", { ascending: true })
              .limit(10000);
          }

          const { data, error } = await query;

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

      // Assignee filter - skip client-side filtering when API-level filtering is applied
      // We already filter by assignees in fetchJobs via SQL join, so always pass this check
      const matchesAssignee = true;

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

      return matchesSearch && matchesStatus && matchesType && matchesAssignee;
    });
  };

  const filterAcceptedQuotes = () => {
    let filtered = acceptedQuotes;

    if (searchTerm) {
      filtered = filtered.filter(
        (quote) =>
          quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.customer_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((quote) => {
        if (!quote.scheduled_date) return false;

        const scheduledDate = new Date(quote.scheduled_date);
        const scheduledDateOnly = new Date(
          scheduledDate.getFullYear(),
          scheduledDate.getMonth(),
          scheduledDate.getDate(),
        );

        if (dateRange.from && dateRange.to) {
          const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
          const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
          return scheduledDateOnly >= fromDate && scheduledDateOnly <= toDate;
        } else if (dateRange.from) {
          const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
          return scheduledDateOnly >= fromDate;
        } else if (dateRange.to) {
          const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
          return scheduledDateOnly <= toDate;
        }

        return true;
      });
    }

    return filtered;
  };
  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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
  const filteredQuotes = filterAcceptedQuotes();
  const jobTypes = [...new Set(jobs.map((job) => job.job_type).filter((type) => type && type.trim() !== ""))];

  const activeFiltersCount = 
    (searchTerm ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (dateRange ? 1 : 0) +
    (selectedAssignees.length > 0 ? 1 : 0);

  return (
    <div className="min-h-screen p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Manage Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {jobTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
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
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
              </div>

              {hasFullAccess && users.length > 0 && (
                <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen} className="space-y-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <label className="text-sm font-medium">Assignees</label>
                    <div className="flex items-center gap-2">
                      {selectedAssignees.length > 0 && (
                        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {selectedAssignees.length}
                        </span>
                      )}
                      {isUsersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedAssignees.includes(user.id)}
                          onCheckedChange={() => toggleAssignee(user.id)}
                        />
                        <label
                          htmlFor={`user-${user.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {user.name}
                        </label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || dateRange || selectedAssignees.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setDateRange(undefined);
                    setSelectedAssignees([]);
                  }}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative">
        {isFilterLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" />
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </div>
        )}
        <JobCalendar
          jobs={filteredJobs}
          quotes={filteredQuotes}
          hideAcceptedQuotes={!hasFullAccess}
          statusFilter={statusFilter}
          onRefresh={fetchData}
          onConvertToJob={handleConvertToJob}
        />
      </div>

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
