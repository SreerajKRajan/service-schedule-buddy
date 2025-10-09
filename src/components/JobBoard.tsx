import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { JobCard } from "./JobCard";
import { JobCalendar } from "./JobCalendar";
import { LocationCard } from "./LocationCard";
import { Search, Filter, Calendar as CalendarIcon, Grid, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface User {
  id: string;
  name: string;
}

interface JobAssignment {
  user_id: string;
  job_id: string;
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
  created_at: string;
  updated_at: string;
}

interface JobBoardProps {
  customerEmail?: string | null;
  userRole?: string | null;
  hasFullAccess?: boolean;
}

export function JobBoard({ customerEmail, userRole, hasFullAccess = true }: JobBoardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const assigneeFromUrl = searchParams.get("assignee");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState(assigneeFromUrl || "all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [groupByLocation, setGroupByLocation] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerUserName, setViewerUserName] = useState<string | null>(null);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<AcceptedQuote[]>([]);
  const [userNotFound, setUserNotFound] = useState(false);

  useEffect(() => {
    // Initial data (exclude jobs here to avoid unfiltered first fetch when URL has assignee)
    fetchUsers();
    fetchJobAssignments();
    fetchAcceptedQuotes();

    // Auto-apply assignee filter when customerEmail is provided (only if no full access)
    if (customerEmail && !hasFullAccess) {
      autoSetAssigneeFilter();
    }
  }, [customerEmail, hasFullAccess]);

  // Separate effect for realtime subscriptions that doesn't depend on assigneeFilter
  useEffect(() => {
    // Set up realtime subscriptions for jobs, job_assignments
    const jobsChannel = supabase
      .channel("jobs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
        },
        (payload) => {
          console.log("Job change detected:", payload);
          // Don't call fetchJobs here to avoid duplicate calls
          // Let the assigneeFilter effect handle it
        },
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel("assignments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_assignments",
        },
        (payload) => {
          console.log("Assignment change detected:", payload);
          fetchJobAssignments();
          // Don't call fetchJobs here to avoid duplicate calls
        },
      )
      .subscribe();

    const quotesChannel = supabase
      .channel("quotes-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accepted_quotes",
        },
        (payload) => {
          console.log("Quote change detected:", payload);
          fetchAcceptedQuotes();
        },
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, []);

  // Fetch jobs once the assignee filter is known (including initial URL value)
  // This effect will run whenever assigneeFilter changes
  useEffect(() => {
    // Only fetch if we're not waiting for user lookup
    if (!userNotFound || assigneeFilter !== "all") {
      fetchJobs(assigneeFilter);
    }
  }, [assigneeFilter]);

  // Fetch jobs once the assignee filter is known (including initial URL value)
  // useEffect(() => {
  //   fetchJobs(assigneeFilter);
  // }, [assigneeFilter]);

  useEffect(() => {
    if (statusFilter === "accepted_quotes") {
      filterAcceptedQuotes();
    } else {
      filterJobs();
    }
  }, [jobs, acceptedQuotes, searchTerm, statusFilter, typeFilter, dateRange, jobAssignments, assigneeFilter]);

  useEffect(() => {
    if (userNotFound) return;

    // If assignee filter is applied, switch away from accepted_quotes status
    if (assigneeFilter !== "all" && statusFilter === "accepted_quotes") {
      setStatusFilter("all");
    }

    // Update URL query params when assignee filter changes
    const newParams = new URLSearchParams(searchParams);
    if (assigneeFilter !== "all") {
      newParams.set("assignee", assigneeFilter);
    } else {
      newParams.delete("assignee");
    }
    setSearchParams(newParams, { replace: true });
  }, [assigneeFilter, userNotFound, searchParams, setSearchParams]);

  const fetchJobs = async (currentAssigneeFilter: string = assigneeFilter) => {
    try {
      setLoading(true);
      // Update overdue jobs to service_due status first
      await supabase.rpc("update_overdue_jobs");

      // Fetch jobs, optionally filtered by assignee using the same /jobs API
      console.log(
        "[JobBoard] Fetching jobs",
        currentAssigneeFilter !== "all" ? `for assignee ${currentAssigneeFilter}` : "(all)",
      );

      // Limit to a reasonable calendar window to avoid 206 partial content
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const windowEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59);

      // If an assignee is selected, use an inner join to job_assignments and filter by user_id
      let query;
      if (currentAssigneeFilter !== "all") {
        query = supabase
          .from("jobs")
          .select("*, job_assignments!inner(user_id)", { count: "exact" })
          .eq("job_assignments.user_id", currentAssigneeFilter)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", windowStart.toISOString())
          .lte("scheduled_date", windowEnd.toISOString())
          .order("scheduled_date", { ascending: true })
          .limit(10000);
      } else {
        query = supabase
          .from("jobs")
          .select("*", { count: "exact" })
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", windowStart.toISOString())
          .lte("scheduled_date", windowEnd.toISOString())
          .order("scheduled_date", { ascending: true })
          .limit(10000);
      }

      const { data, error } = await query;
      if (error) throw error;
      console.log("[JobBoard] Fetched jobs:", (data || []).length);
      // Ensure unique jobs by id (in case of multiple assignments)
      const uniqueJobsMap = new Map<string, any>();
      (data || []).forEach((j: any) => {
        const id = j.id;
        if (id && !uniqueJobsMap.has(id)) uniqueJobsMap.set(id, j);
      });
      const uniqueJobs = Array.from(uniqueJobsMap.values()) as unknown as Job[];
      setJobs(uniqueJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("id, name").eq("active", true);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchJobAssignments = async () => {
    try {
      const { data, error } = await supabase.from("job_assignments").select("user_id, job_id");

      if (error) throw error;
      setJobAssignments(data || []);
    } catch (error) {
      console.error("Error fetching job assignments:", error);
    }
  };

  const fetchAcceptedQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from("accepted_quotes")
        .select("*")
        .neq("status", "converted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAcceptedQuotes(data || []);
    } catch (error) {
      console.error("Error fetching accepted quotes:", error);
    }
  };

  const filterJobs = () => {
    let filtered = jobs;

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.customer_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.job_type.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (statusFilter !== "all" && statusFilter !== "accepted_quotes") {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((job) => job.job_type === typeFilter);
    }

    // Assignee filtering is now handled server-side via query params on /jobs
    // (joining job_assignments!inner and filtering by job_assignments.user_id)
    // So we do not perform additional client-side filtering here to avoid mismatches.

    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((job) => {
        if (!job.scheduled_date) return false;

        const scheduledDate = new Date(job.scheduled_date);
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

    setFilteredJobs(filtered);
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

    setFilteredQuotes(filtered);
  };

  const jobTypes = [...new Set(jobs.map((job) => job.job_type).filter((type) => type && type.trim() !== ""))];

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAssigneeFilter("all");
    setDateRange(undefined);
    setGroupByLocation(false);
  };

  const autoSetAssigneeFilter = async () => {
    if (!customerEmail) return;

    try {
      console.log("[JobBoard] Auto-setting assignee filter for email:", customerEmail);
      // Try to find user by email (case-insensitive)
      const { data: userByEmail } = await supabase
        .from("users")
        .select("id, name")
        .ilike("email", customerEmail)
        .maybeSingle();

      if (userByEmail) {
        console.log("[JobBoard] Found user by email:", userByEmail);
        setAssigneeFilter(userByEmail.id);
        setViewerUserId(userByEmail.id);
        setViewerUserName(userByEmail.name || null);
        setUserNotFound(false);
        return;
      }

      // Try to find user by name as fallback
      const { data: userByName } = await supabase
        .from("users")
        .select("id, name")
        .eq("name", customerEmail)
        .maybeSingle();

      if (userByName) {
        console.log("[JobBoard] Found user by name:", userByName);
        setAssigneeFilter(userByName.id);
        setViewerUserId(userByName.id);
        setViewerUserName(userByName.name || null);
        setUserNotFound(false);
      } else {
        console.log("[JobBoard] No user found for:", customerEmail);
        setUserNotFound(true);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error setting assignee filter:", error);
      setUserNotFound(true);
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchJobs(assigneeFilter);
    fetchUsers();
    fetchJobAssignments();
    fetchAcceptedQuotes();
  };

  const groupJobsByLocation = (jobs: Job[]) => {
    const grouped = jobs.reduce(
      (acc, job) => {
        const location = job.customer_address || "No Address";
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(job);
        return acc;
      },
      {} as Record<string, Job[]>,
    );

    return grouped;
  };

  if (userNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">User Not Found</CardTitle>
            <CardDescription>The user ID provided in the URL does not match any user in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please check the URL and try again, or contact support if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse w-48"></div>
              <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-full"></div>
                <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Jobs</h2>
          <p className="text-muted-foreground">Manage your service jobs and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            <Grid className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar
          </Button>
        </div>
      </div>

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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {!customerEmail && assigneeFilter === "all" && (
                    <SelectItem value="accepted_quotes">Accepted Quotes</SelectItem>
                  )}
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="service_due">Service Due</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="all">All Types</SelectItem>
                  {jobTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-full" disabled={!!customerEmail && !hasFullAccess}>
                  <SelectValue
                    placeholder={
                      customerEmail && !hasFullAccess
                        ? viewerUserName
                          ? `Assignee: ${viewerUserName}`
                          : "Assignee"
                        : "Filter by assignee"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {(hasFullAccess || !customerEmail) && <SelectItem value="all">All Assignees</SelectItem>}
                  {(customerEmail && !hasFullAccess ? users.filter((u) => u.id === viewerUserId) : users).map(
                    (user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && !dateRange?.to && "text-muted-foreground",
                    )}
                  >
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
                    {(dateRange?.from || dateRange?.to) && (
                      <X
                        className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateRange(undefined);
                        }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center space-x-2">
              <Switch id="group-by-location" checked={groupByLocation} onCheckedChange={setGroupByLocation} />
              <Label htmlFor="group-by-location" className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Group by Location
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} className="text-muted-foreground">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "calendar" ? (
        <JobCalendar
          jobs={filteredJobs}
          quotes={filteredQuotes}
          statusFilter={statusFilter}
          onRefresh={refreshData}
          hideAcceptedQuotes={
            statusFilter !== "accepted_quotes" && !(statusFilter === "all" && assigneeFilter === "all" && hasFullAccess)
          }
        />
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              {statusFilter === "accepted_quotes"
                ? `${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? "s" : ""} found`
                : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {statusFilter === "accepted_quotes" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuotes.map((quote) => (
                  <Card key={quote.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">Quote - {quote.customer_name}</CardTitle>
                      <CardDescription>
                        {quote.scheduled_date ? new Date(quote.scheduled_date).toLocaleString() : "Not scheduled"}
                      </CardDescription>
                      <div className="flex gap-2">
                        <Badge>{quote.status}</Badge>
                        {quote.first_time && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            First Time
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {quote.customer_address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(
                                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(quote.customer_address)}`,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            className="text-primary hover:underline line-clamp-1 cursor-pointer"
                          >
                            {quote.customer_address}
                          </a>
                        </div>
                      )}
                      {quote.customer_phone && (
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${quote.customer_phone}`} className="text-primary hover:underline">
                            {quote.customer_phone}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredQuotes.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-muted-foreground text-center">
                      <h3 className="text-lg font-semibold mb-2">No quotes found</h3>
                      <p>Try adjusting your search criteria.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : groupByLocation ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(groupJobsByLocation(filteredJobs)).map(([location, jobs]) => (
                <LocationCard key={location} location={location} jobs={jobs} onUpdate={refreshData} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onUpdate={refreshData} />
              ))}
            </div>
          )}

          {statusFilter !== "accepted_quotes" && filteredJobs.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-muted-foreground text-center">
                  <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
                  <p>Try adjusting your search criteria or create a new job.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
