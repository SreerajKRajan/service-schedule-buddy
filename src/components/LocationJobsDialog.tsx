import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { JobCard } from "./JobCard";

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
}

interface LocationJobsDialogProps {
  location: string;
  jobs: Job[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function LocationJobsDialog({ 
  location, 
  jobs, 
  open, 
  onOpenChange, 
  onUpdate 
}: LocationJobsDialogProps) {
  const handleJobUpdate = () => {
    onUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Jobs at {location}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''}
            </Badge>
            {jobs[0]?.customer_name && (
              <span>Customer: {jobs[0].customer_name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard 
              key={job.id} 
              job={job} 
              onUpdate={handleJobUpdate} 
            />
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No jobs found for this location.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}