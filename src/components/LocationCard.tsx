import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Calendar, Clock, DollarSign } from "lucide-react";
import { LocationJobsDialog } from "./LocationJobsDialog";

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

interface LocationCardProps {
  location: string;
  jobs: Job[];
  onUpdate: () => void;
}

export function LocationCard({ location, jobs, onUpdate }: LocationCardProps) {
  const [showJobsDialog, setShowJobsDialog] = useState(false);

  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    
    jobs.forEach(job => {
      if (job.status in counts) {
        counts[job.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  };

  const getTotalValue = () => {
    return jobs.reduce((total, job) => total + (job.price || 0), 0);
  };

  const getTotalDuration = () => {
    return jobs.reduce((total, job) => total + (job.estimated_duration || 0), 0);
  };

  const getNextScheduledJob = () => {
    const upcoming = jobs
      .filter(job => job.scheduled_date && job.status !== 'completed' && job.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    
    return upcoming[0];
  };

  const statusCounts = getStatusCounts();
  const totalValue = getTotalValue();
  const totalDuration = getTotalDuration();
  const nextJob = getNextScheduledJob();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowJobsDialog(true)}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
              <div>
                <CardTitle className="text-lg">{location}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                  </Badge>
                  {jobs[0]?.customer_name && (
                    <span className="text-sm text-muted-foreground">
                      {jobs[0].customer_name}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              View Jobs
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.in_progress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statusCounts.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statusCounts.cancelled}</div>
              <div className="text-sm text-muted-foreground">Cancelled</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {totalValue > 0 && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-green-600">{formatCurrency(totalValue)}</span>
              </div>
            )}
            
            {totalDuration > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{totalDuration} hours total</span>
              </div>
            )}
            
            {nextJob && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Next: {formatDate(nextJob.scheduled_date)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {[...new Set(jobs.map(job => job.job_type))].map(type => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <LocationJobsDialog
        location={location}
        jobs={jobs}
        open={showJobsDialog}
        onOpenChange={setShowJobsDialog}
        onUpdate={onUpdate}
      />
    </>
  );
}