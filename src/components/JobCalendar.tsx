import { useState, useEffect } from "react";
import { Calendar as BigCalendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarDays, Grid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCard } from "./JobCard";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

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
  resource: Job;
}

interface JobCalendarProps {
  jobs: Job[];
  onRefresh: () => void;
}

export function JobCalendar({ jobs, onRefresh }: JobCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    convertJobsToEvents();
  }, [jobs]);

  const convertJobsToEvents = () => {
    const calendarEvents: CalendarEvent[] = [];

    // Add all jobs (including recurring instances)
    jobs.forEach(job => {
      if (!job.scheduled_date) return;
      
      const startDate = new Date(job.scheduled_date);
      const endDate = new Date(startDate);
      
      // Add estimated duration or default to 2 hours
      const duration = job.estimated_duration || 2;
      endDate.setHours(startDate.getHours() + duration);

      calendarEvents.push({
        id: job.id,
        title: `${job.title} - ${job.customer_name || 'Customer'}`,
        start: startDate,
        end: endDate,
        resource: job,
      });
    });

    setEvents(calendarEvents);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedJob(event.resource);
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
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const getDateTitle = () => {
    switch (view) {
      case 'month':
        return format(currentDate, "MMMM yyyy");
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case 'day':
        return format(currentDate, "MMMM d, yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const job = event.resource;
    let backgroundColor = '#3174ad';
    
    switch (job.status) {
      case 'pending':
        backgroundColor = '#f59e0b';
        break;
      case 'in_progress':
        backgroundColor = '#3b82f6';
        break;
      case 'completed':
        backgroundColor = '#10b981';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: 'none',
        fontSize: '12px',
      }
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
                      "w-full sm:w-auto sm:min-w-[200px] justify-center text-center font-medium text-xs sm:text-sm"
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
          <div className="h-[400px] sm:h-96 md:h-[600px]">
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
              style={{ height: '100%' }}
              popup
              toolbar={false}
              formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: () => '',
                agendaTimeRangeFormat: () => '',
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-2 sm:px-0">
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

      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              View and manage job information
            </DialogDescription>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}