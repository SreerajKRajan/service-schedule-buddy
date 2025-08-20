import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Trash2, RotateCcw, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Job {
  id: string;
  title: string;
  is_recurring: boolean;
  job_type: string;
  customer_name?: string;
  scheduled_date?: string;
  created_at?: string;
  quoted_by?: string;
}

interface DeleteJobDialogProps {
  job: Job;
  onUpdate: () => void;
  disabled?: boolean;
}

export function DeleteJobDialog({ job, onUpdate, disabled }: DeleteJobDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteOption, setDeleteOption] = useState<"single" | "sequence">("single");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const deleteSingleJob = async () => {
    setDeleting(true);
    try {
      // First delete job assignments
      const { error: assignmentError } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', job.id);

      if (assignmentError) throw assignmentError;

      // Delete job schedules if recurring (but only for this specific job)
      if (job.is_recurring) {
        const { error: scheduleError } = await supabase
          .from('job_schedules')
          .delete()
          .eq('job_id', job.id);

        if (scheduleError) throw scheduleError;
      }

      // Finally delete the job
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', job.id);

      if (jobError) throw jobError;

      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteRecurringSequence = async () => {
    setDeleting(true);
    try {
      // First, find the job schedule for this job
      const { data: schedule, error: scheduleError } = await supabase
        .from('job_schedules')
        .select('id')
        .eq('job_id', job.id)
        .eq('is_active', true)
        .maybeSingle();

      if (scheduleError) throw scheduleError;

      let jobIds: string[] = [job.id]; // Always include the current job

      if (schedule) {
        // Find all jobs that share the same schedule
        const { data: relatedJobs, error: fetchError } = await supabase
          .from('job_schedules')
          .select('job_id')
          .eq('id', schedule.id);

        if (fetchError) throw fetchError;
        
        if (relatedJobs && relatedJobs.length > 0) {
          jobIds = relatedJobs.map(s => s.job_id);
        }
      } else {
        // If no schedule found, try to find jobs created as part of the same recurring batch
        // This handles cases where jobs were created together but might not have active schedules
        const { data: relatedJobs, error: fetchError } = await supabase
          .from('jobs')
          .select('id')
          .eq('job_type', job.job_type)
          .eq('customer_name', job.customer_name || '')
          .eq('is_recurring', true)
          .eq('quoted_by', job.quoted_by || '')
          .gte('created_at', new Date(new Date(job.scheduled_date || job.created_at).getTime() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours of each other
          .lte('created_at', new Date(new Date(job.scheduled_date || job.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (fetchError) throw fetchError;
        
        if (relatedJobs && relatedJobs.length > 0) {
          jobIds = relatedJobs.map(j => j.id);
        }
      }

      // Delete all job assignments for related jobs
      const { error: assignmentError } = await supabase
        .from('job_assignments')
        .delete()
        .in('job_id', jobIds);

      if (assignmentError) throw assignmentError;

      // Delete all job schedules for related jobs
      const { error: scheduleDeleteError } = await supabase
        .from('job_schedules')
        .delete()
        .in('job_id', jobIds);

      if (scheduleDeleteError) throw scheduleDeleteError;

      // Finally delete all related jobs
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .in('id', jobIds);

      if (jobError) throw jobError;

      toast({
        title: "Success",
        description: `Deleted ${jobIds.length} job${jobIds.length > 1 ? 's' : ''} from the recurring sequence`,
      });
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting recurring sequence:', error);
      toast({
        title: "Error",
        description: "Failed to delete recurring sequence",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (deleteOption === "sequence") {
      deleteRecurringSequence();
    } else {
      deleteSingleJob();
    }
  };

  const getDeleteDescription = () => {
    if (!job.is_recurring) {
      return `Are you sure you want to delete "${job.title}"? This action cannot be undone.`;
    }

    if (deleteOption === "single") {
      return `Are you sure you want to delete this instance of "${job.title}"? The recurring schedule will remain active for future occurrences.`;
    } else {
      return `Are you sure you want to delete the entire recurring sequence for "${job.title}"? This will delete all related recurring jobs and schedules. This action cannot be undone.`;
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete Job
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You're about to delete "{job.title}"
              </p>
              
              {job.is_recurring && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Choose deletion option:</p>
                  <RadioGroup 
                    value={deleteOption} 
                    onValueChange={(value: "single" | "sequence") => setDeleteOption(value)}
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-3 p-3 border rounded-lg">
                      <RadioGroupItem value="single" id="single" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="single" className="flex items-center gap-2 font-medium cursor-pointer">
                          <Calendar className="h-4 w-4" />
                          Delete this job only
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Remove only this scheduled occurrence. The recurring pattern continues.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 border rounded-lg">
                      <RadioGroupItem value="sequence" id="sequence" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="sequence" className="flex items-center gap-2 font-medium cursor-pointer">
                          <RotateCcw className="h-4 w-4" />
                          Delete entire sequence
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Remove all jobs in this recurring sequence permanently.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                {getDeleteDescription()}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : 
              job.is_recurring && deleteOption === "sequence" ? "Delete Sequence" : "Delete Job"
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}