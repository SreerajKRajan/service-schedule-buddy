import { useState, useEffect } from "react";
import { Calendar as BigCalendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment-timezone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  CalendarDays,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  Calendar,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCard } from "./JobCard";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

const accountTimezone = "America/Chicago";

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
}

interface JobSchedule {
  id: string;
  job_id: string;
  frequency: string;
  interval_value: number;
  next_due_date: string;
  end_date: string;
  is_active: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Job | AcceptedQuote;
  type: "job" | "quote";
}

interface JobAssignment {
  user_id: string;
  job_id: string;
}

interface JobCalendarProps {
  jobs: Job[];
  quotes?: AcceptedQuote[];
  statusFilter?: string;
  onRefresh: () => void;
  hideAcceptedQuotes?: boolean;
  onConvertToJob?: (quote: AcceptedQuote, onSuccess: () => void, onError: () => void) => void;
  assigneeFilter?: string;
  jobAssignments?: JobAssignment[];
}

export function JobCalendar({
  jobs,
  quotes = [],
  statusFilter: parentStatusFilter,
  onRefresh,
  hideAcceptedQuotes = false,
  onConvertToJob,
  assigneeFilter = "all",
  jobAssignments = [],
}: JobCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<AcceptedQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthRowHeight, setMonthRowHeight] = useState<number>(140);

  useEffect(() => {
    if (!hideAcceptedQuotes) {
      fetchAcceptedQuotes();
    }
  }, [hideAcceptedQuotes]);

  useEffect(() => {
    convertJobsToEvents();
  }, [jobs, quotes, acceptedQuotes, statusFilter, parentStatusFilter]);

  // Dynamically set month row height so all events fit without "+X more"
  useEffect(() => {
    if (view !== "month") return;

    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const counts: Record<string, number> = {};
    events.forEach((ev) => {
      const d = ev.start;
      if (d >= monthStart && d <= monthEnd) {
        const key = d.toISOString().slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const maxCount = Object.values(counts).reduce((a, b) => Math.max(a, b), 0);
    const base = 44; // space for date label and padding
    const per = 26; // per-event line height (safer buffer)
    setMonthRowHeight(base + Math.max(maxCount, 1) * per);
  }, [events, view, currentDate]);

  const weeksInMonth =
    view === "month"
      ? Math.ceil(
          (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() +
            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()) /
            7,
        )
      : 0;

  // Calculate dynamic height for week/day views
  const weekDayHeight = () => {
    if (view === "month") {
      return 64 + weeksInMonth * monthRowHeight; // header + rows
    }
    // For week/day views: calculate based on time slots (6 AM to 11:59 PM = 18 hours)
    // Each hour = 60px, plus header (100px)
    const hours = 18; // 6 AM to 11:59 PM
    const pixelsPerHour = 60;
    return 100 + hours * pixelsPerHour;
  };

  const monthTotalHeight = weekDayHeight();

  const fetchAcceptedQuotes = async () => {
    try {
      const { data, error } = await supabase.from("accepted_quotes").select("*").neq("status", "converted");

      if (error) throw error;
      setAcceptedQuotes(data || []);
    } catch (error) {
      console.error("Error fetching accepted quotes:", error);
    }
  };

  const formatUTCDateTime = (dateStr) => {
    // Parse the UTC date and convert to CDT timezone
    const m = moment.parseZone(dateStr).tz(accountTimezone, true);
    // Format as: YYYY-MM-DD h:mm AM/PM
    return m.format("YYYY-MM-DD h:mm A");
  };

  const convertJobsToEvents = () => {
    const calendarEvents: CalendarEvent[] = [];

    // Show accepted quotes if not hidden (use passed quotes or internal acceptedQuotes)
    if (!hideAcceptedQuotes) {
      const quotesToShow = quotes.length > 0 ? quotes : acceptedQuotes;
      quotesToShow.forEach((quote) => {
        if (!quote.scheduled_date) return;
        // Skip if only showing accepted quotes and calendar has status filter for jobs
        if (statusFilter === "accepted_quotes") {
          // When filtered to only quotes, skip this - we'll add them below
          return;
        }

        const m = moment.parseZone(quote.scheduled_date).tz(accountTimezone, true);
        const startDate = new Date(m.year(), m.month(), m.date(), m.hour(), m.minute());
        const endDate = new Date(m.year(), m.month(), m.date(), m.hour() + 2, m.minute());

        // Format time for display (12-hour with AM/PM)
        const timeStr = m.format("h A");

        calendarEvents.push({
          id: quote.id,
          title: `${timeStr} ${quote.customer_name || "Customer"}`,
          start: startDate,
          end: endDate,
          resource: quote,
          type: "quote",
        });
      });
    }

    // If filtered to only show accepted quotes
    if (statusFilter === "accepted_quotes" && !hideAcceptedQuotes) {
      const quotesToShow = quotes.length > 0 ? quotes : acceptedQuotes;
      quotesToShow.forEach((quote) => {
        if (!quote.scheduled_date) return;

        const m = moment.parseZone(quote.scheduled_date).tz(accountTimezone, true);
        const startDate = new Date(m.year(), m.month(), m.date(), m.hour(), m.minute());
        const endDate = new Date(m.year(), m.month(), m.date(), m.hour() + 2, m.minute());

        // Format time for display (12-hour with AM/PM)
        const timeStr = m.format("h A");

        calendarEvents.push({
          id: quote.id,
          title: `${timeStr} ${quote.customer_name || "Customer"}`,
          start: startDate,
          end: endDate,
          resource: quote,
          type: "quote",
        });
      });
    }

    // Show jobs (unless filtered to only accepted quotes)
    if (statusFilter !== "accepted_quotes") {
      jobs.forEach((job) => {
        if (!job.scheduled_date) return;

        // Apply status filter for jobs
        if (statusFilter !== "all" && job.status !== statusFilter) return;

        // Assignee filtering is now done at the API level in JobBoard
        const m = moment.parseZone(job.scheduled_date).tz(accountTimezone, true);
        const startDate = new Date(m.year(), m.month(), m.date(), m.hour(), m.minute());

        // Add estimated duration or default to 2 hours
        const duration = job.estimated_duration || 2;
        const endDate = new Date(m.year(), m.month(), m.date(), m.hour() + duration, m.minute());

        // Format time for display (12-hour with AM/PM)
        const timeStr = m.format("h A");

        // Add (R) indicator for recurring jobs
        const recurringIndicator = job.is_recurring ? " (R)" : "";

        calendarEvents.push({
          id: job.id,
          title: `${timeStr} ${job.customer_name || "Customer"}${recurringIndicator}`,
          start: startDate,
          end: endDate,
          resource: job,
          type: "job",
        });
      });
    }

    setEvents(calendarEvents);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.type === "job") {
      setSelectedJob(event.resource as Job);
      setSelectedQuote(null);
    } else {
      setSelectedQuote(event.resource as AcceptedQuote);
      setSelectedJob(null);
    }
  };

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const navigateBack = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const getDateTitle = () => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "MMMM d, yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = "#3174ad";

    if (event.type === "quote") {
      backgroundColor = "#8b5cf6"; // Purple for quotes
    } else {
      const job = event.resource as Job;
      switch (job.status) {
        case "pending":
          backgroundColor = "#f59e0b";
          break;
        case "in_progress":
          backgroundColor = "#3b82f6";
          break;
        case "completed":
          backgroundColor = "#10b981";
          break;
        case "cancelled":
          backgroundColor = "#ef4444";
          break;
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.8,
        color: "white",
        border: "none",
        fontSize: "12px",
      },
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Job Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-muted rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Job Calendar
            </CardTitle>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  {!hideAcceptedQuotes && <SelectItem value="accepted_quotes">Accepted Quotes</SelectItem>}
                </SelectContent>
              </Select>

              {/* Mobile: Stack view buttons, Desktop: Row */}
              <div className="flex flex-wrap gap-1 sm:gap-2">
                <Button
                  variant={view === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("month")}
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  Month
                </Button>
                <Button
                  variant={view === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("week")}
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  Week
                </Button>
                <Button
                  variant={view === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("day")}
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  Day
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mt-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={navigateToday} className="text-xs sm:text-sm">
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={navigateBack}>
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>

            <div className="flex-1 flex justify-center sm:justify-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-auto sm:min-w-[200px] justify-center text-center font-medium text-xs sm:text-sm",
                    )}
                  >
                    {getDateTitle()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <DatePicker
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(date);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div
            className="min-h-[320px]"
            style={{
              height: view === "month" ? monthTotalHeight : 600,
              // @ts-ignore - CSS variable for month row height
              ["--month-row-height" as any]: `${monthRowHeight}px`,
            }}
          >
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={currentDate}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              min={new Date(1970, 1, 1, 6, 0, 0)}
              max={new Date(1970, 1, 1, 23, 59, 59)}
              key={
                view === "month"
                  ? `month-${currentDate.getFullYear()}-${currentDate.getMonth()}-${monthRowHeight}`
                  : `view-${view}`
              }
              style={{ height: "100%" }}
              popup={false}
              toolbar={false}
              formats={{
                timeGutterFormat: "h A",
                eventTimeRangeFormat: () => "",
                agendaTimeRangeFormat: () => "",
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-2 sm:px-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-500 rounded"></div>
          <span className="text-xs sm:text-sm">Quote</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-500 rounded"></div>
          <span className="text-xs sm:text-sm">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded"></div>
          <span className="text-xs sm:text-sm">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded"></div>
          <span className="text-xs sm:text-sm">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded"></div>
          <span className="text-xs sm:text-sm">Cancelled</span>
        </div>
      </div>

      <Dialog
        open={!!selectedJob || !!selectedQuote}
        onOpenChange={() => {
          setSelectedJob(null);
          setSelectedQuote(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuote ? "Quote Details" : "Job Details"}</DialogTitle>
            <DialogDescription>View and manage {selectedQuote ? "quote" : "job"} information</DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <JobCard
              job={selectedJob}
              onUpdate={() => {
                onRefresh();
                setSelectedJob(null);
              }}
            />
          )}
          {selectedQuote && (
            <Card className="h-full border-0 shadow-none">
              <CardHeader className="space-y-2 px-0">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">Quote Request</CardTitle>
                </div>
                <CardDescription className="line-clamp-2">Accepted quote for scheduled service</CardDescription>
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-purple-100 text-purple-800">{selectedQuote.status}</Badge>
                  {selectedQuote.first_time && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      First Time
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-0">
                <div className="space-y-2 text-sm">
                  {selectedQuote.customer_name && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {selectedQuote.ghl_contact_id ? (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(
                              `https://app.gohighlevel.com/v2/location/b8qvo7VooP3JD3dIZU42/contacts/detail/${selectedQuote.ghl_contact_id}`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {selectedQuote.customer_name}
                        </a>
                      ) : (
                        <span>{selectedQuote.customer_name}</span>
                      )}
                    </div>
                  )}

                  {selectedQuote.customer_address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedQuote.customer_address)}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                        className="text-primary hover:underline line-clamp-1 cursor-pointer"
                      >
                        {selectedQuote.customer_address}
                      </a>
                    </div>
                  )}

                  {selectedQuote.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${selectedQuote.customer_phone}`} className="text-primary hover:underline">
                        {selectedQuote.customer_phone}
                      </a>
                    </div>
                  )}

                  {selectedQuote.customer_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${selectedQuote.customer_email}`}
                        className="text-primary hover:underline line-clamp-1"
                      >
                        {selectedQuote.customer_email}
                      </a>
                    </div>
                  )}

                  {selectedQuote.scheduled_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatUTCDateTime(selectedQuote.scheduled_date)}</span>
                    </div>
                  )}
                </div>

                {selectedQuote.jobs_selected &&
                  Array.isArray(selectedQuote.jobs_selected) &&
                  selectedQuote.jobs_selected.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Selected Services ({selectedQuote.jobs_selected.length})</h4>
                      <div className="grid gap-2">
                        {selectedQuote.jobs_selected.map((service: any, index: number) => (
                          <div key={index} className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{service.title || service.name || "Service"}</div>
                                {service.service_description && (
                                  <div className="text-sm text-muted-foreground">{service.service_description}</div>
                                )}
                              </div>
                              <div className="text-right">
                                {service.price && <div className="font-medium">${service.price}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Convert to Job Button */}
                {selectedQuote.status === "pending" && onConvertToJob && (
                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        const quoteToConvert = selectedQuote;

                        // Close the modal immediately
                        setSelectedQuote(null);

                        const onSuccess = async () => {
                          try {
                            const { error } = await supabase
                              .from("accepted_quotes")
                              .update({ status: "converted" })
                              .eq("id", quoteToConvert.id);

                            if (error) throw error;

                            toast.success("Quote converted to job successfully");
                            fetchAcceptedQuotes();
                            onRefresh();
                          } catch (error) {
                            console.error("Error updating quote status:", error);
                            toast.error("Failed to update quote status. Please try again.");
                            fetchAcceptedQuotes();
                          }
                        };

                        const onError = async () => {
                          toast.error("Failed to convert quote to job. Please try again.");
                          fetchAcceptedQuotes();
                        };

                        onConvertToJob(quoteToConvert, onSuccess, onError);
                      }}
                      className="w-full"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Convert to Job{selectedQuote.jobs_selected.length > 1 ? "s" : ""}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
