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
      // Find all recurring jobs with the same customer, job type, and quoted_by
      // that are part of the same recurring sequence
      let query = supabase
        .from('jobs')
        .select('id, title, scheduled_date')
        .eq('job_type', job.job_type)
        .eq('customer_name', job.customer_name || '')
        .eq('is_recurring', true);

      // Only filter by quoted_by if it exists
      if (job.quoted_by) {
        query = query.eq('quoted_by', job.quoted_by);
      } else {
        query = query.is('quoted_by', null);
      }

      const { data: relatedJobs, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let jobIds: string[] = [job.id]; // Always include the current job
      
      if (relatedJobs && relatedJobs.length > 1) {
        // Use all related recurring jobs
        jobIds = relatedJobs.map(j => j.id);
      }

      console.log(`Deleting ${jobIds.length} recurring jobs`);

      // Delete all job assignments first
      const { error: assignmentsError } = await supabase
        .from('job_assignments')
        .delete()
        .in('job_id', jobIds);

      if (assignmentsError) throw assignmentsError;

      // Delete job schedules
      const { error: schedulesError } = await supabase
        .from('job_schedules')
        .delete()
        .in('job_id', jobIds);

      if (schedulesError) throw schedulesError;

      // Finally, delete all the jobs
      const { error: jobsError } = await supabase
        .from('jobs')
        .delete()
        .in('id', jobIds);

      if (jobsError) throw jobsError;

      toast({
        title: "Success",
        description: `Deleted ${jobIds.length} recurring job${jobIds.length > 1 ? 's' : ''} successfully`,
      });

      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting recurring jobs:', error);
      toast({
        title: "Error",
        description: "Failed to delete recurring jobs",
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
      return `Are you sure you want to delete this single occurrence of "${job.title}"? Other recurring appointments will remain scheduled.`;
    } else {
      return `Are you sure you want to delete ALL recurring appointments for "${job.title}"? This will delete the entire recurring sequence. This action cannot be undone.`;
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