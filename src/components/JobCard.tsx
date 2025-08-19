import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, Phone, Mail, Users, RotateCcw, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditJobDialog } from "./EditJobDialog";

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
}

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
}

export function JobCard({ job, onUpdate }: JobCardProps) {
  const [updating, setUpdating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 3) return 'bg-red-100 text-red-800';
    if (priority === 2) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 3) return 'High';
    if (priority === 2) return 'Medium';
    return 'Low';
  };

  const updateJobStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'completed') {
        updates.completed_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', job.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Job status updated to ${newStatus}`,
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating job:', error);
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{job.title}</CardTitle>
          {job.is_recurring && (
            <Badge variant="outline" className="flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Recurring
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {job.description}
        </CardDescription>
        <div className="flex gap-2 flex-wrap">
          <Badge className={getStatusColor(job.status)}>
            {job.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColor(job.priority)}>
            {getPriorityText(job.priority)} Priority
          </Badge>
          <Badge variant="outline">
            {job.job_type}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          {job.customer_name && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{job.customer_name}</span>
            </div>
          )}
          
          {job.customer_address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="line-clamp-1">{job.customer_address}</span>
            </div>
          )}
          
          {job.customer_phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{job.customer_phone}</span>
            </div>
          )}
          
          {job.customer_email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="line-clamp-1">{job.customer_email}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(job.scheduled_date)}</span>
          </div>
          
          {job.estimated_duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{job.estimated_duration} hours</span>
            </div>
          )}
        </div>

        {job.notes && (
          <div className="text-sm bg-muted p-2 rounded">
            <strong>Notes:</strong> {job.notes}
          </div>
        )}

        <div className="pt-2 space-y-2">
          <Select
            value={job.status}
            onValueChange={updateJobStatus}
            disabled={updating}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Update status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setShowEditDialog(true)}
            className="w-full flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Job
          </Button>
        </div>
      </CardContent>

      <EditJobDialog
        job={job}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={onUpdate}
      />
    </Card>
  );
}