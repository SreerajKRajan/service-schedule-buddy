import { useState, useEffect } from "react";
import { Calendar, momentLocalizer, View } from "react-big-calendar";
import moment from "moment";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Grid, List } from "lucide-react";
import { JobCard } from "./JobCard";
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
  created_at: string;
  updated_at: string;
  price: number;
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
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Job Calendar
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={view === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("month")}
              >
                Month
              </Button>
              <Button
                variant={view === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("week")}
              >
                Week
              </Button>
              <Button
                variant={view === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("day")}
              >
                Day
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 md:h-[600px]">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              style={{ height: '100%' }}
              popup
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-sm">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm">Cancelled</span>
        </div>
      </div>

      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-md">
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