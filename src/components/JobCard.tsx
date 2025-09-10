import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, Phone, Mail, Users, RotateCcw, Edit, DollarSign, UserCheck } from "lucide-react";
import React from "react";
import { useToast } from "@/hooks/use-toast";
import { EditJobDialog } from "./EditJobDialog";
import { DeleteJobDialog } from "./DeleteJobDialog";

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

interface JobAssignment {
  user_id: string;
  job_id: string;
  users: {
    name: string;
  };
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

interface JobService {
  id: string;
  job_id: string;
  service_id: string;
  service_name: string;
  service_description: string | null;
  price: number | null;
  duration: number | null;
}

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
}

export function JobCard({ job, onUpdate }: JobCardProps) {
  const [updating, setUpdating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([]);
  const [jobSchedule, setJobSchedule] = useState<JobSchedule | null>(null);
  const [jobServices, setJobServices] = useState<JobService[]>([]);
  const [quotedByUser, setQuotedByUser] = useState<string>("");
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'on_the_way': return 'bg-orange-100 text-orange-800';
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

      // Send completion webhook if status is completed
      if (newStatus === 'completed') {
        try {
          await supabase.functions.invoke('project-completion-webhook', {
            body: { jobId: job.id }
          });
        } catch (webhookError) {
          console.error('Failed to send completion webhook:', webhookError);
          // Don't fail the status update if webhook fails
        }
      }

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


  const fetchJobAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          user_id,
          job_id,
          users (name)
        `)
        .eq('job_id', job.id);

      if (error) throw error;
      setJobAssignments(data || []);
    } catch (error) {
      console.error('Error fetching job assignments:', error);
    }
  };

  const fetchJobSchedule = async () => {
    if (!job.is_recurring) return;
    
    try {
      const { data, error } = await supabase
        .from('job_schedules')
        .select('*')
        .eq('job_id', job.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setJobSchedule(data);
    } catch (error) {
      console.error('Error fetching job schedule:', error);
    }
  };

  const fetchJobServices = async () => {
    try {
      const { data, error } = await supabase
        .from('job_services')
        .select('*')
        .eq('job_id', job.id);

      if (error) throw error;
      setJobServices(data || []);
    } catch (error) {
      console.error('Error fetching job services:', error);
    }
  };

  const fetchQuotedByUser = async () => {
    if (!job.quoted_by) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('id', job.quoted_by)
        .single();

      if (error) throw error;
      setQuotedByUser(data?.name || "");
    } catch (error) {
      console.error('Error fetching quoted by user:', error);
    }
  };

  React.useEffect(() => {
    fetchJobAssignments();
    fetchJobSchedule();
    fetchJobServices();
    fetchQuotedByUser();
  }, [job.id, job.is_recurring, job.quoted_by]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not scheduled';
    // Display exactly as received (no timezone conversion)
    // Support values with seconds/timezone or simple datetime-local strings
    const base = dateString.replace('Z', '');
    const trimmed = base.length >= 16 ? base.slice(0, 16) : base;
    return trimmed.replace('T', ', ');
  };

  const formatPrice = (price: number) => {
    if (!price) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
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
            {job.status === 'on_the_way' ? 'On The Way' : job.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColor(job.priority)}>
            {getPriorityText(job.priority)} Priority
          </Badge>
          <Badge variant="outline">
            {job.job_type}
          </Badge>
          {job.first_time && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              First Time
            </Badge>
          )}
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

          {quotedByUser && (
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="line-clamp-1">
                <strong>Quoted by:</strong> {quotedByUser}
              </span>
            </div>
          )}

          {jobAssignments.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="line-clamp-1">
                <strong>Assigned:</strong> {jobAssignments.map(assignment => assignment.users.name).join(', ')}
              </span>
            </div>
          )}

          {job.price && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-green-600">{formatPrice(job.price)}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(job.scheduled_date)}</span>
          </div>

          {job.is_recurring && jobSchedule && (
            <div className="bg-blue-50 p-2 rounded text-xs">
              <div className="font-medium text-blue-800 mb-1">Recurring Schedule</div>
              <div className="text-blue-600">
                Every {jobSchedule.interval_value} {jobSchedule.frequency.replace('ly', '')}
                {jobSchedule.interval_value > 1 ? 's' : ''}
              </div>
              <div className="text-blue-600">
                Next due: {formatDate(jobSchedule.next_due_date)}
              </div>
            </div>
          )}
          
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

        {/* Services Breakdown */}
        {jobServices.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Selected Services ({jobServices.length})</h4>
            <div className="grid gap-2">
              {jobServices.map((service) => (
                <div key={service.id} className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{service.service_name}</div>
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
              <SelectItem value="on_the_way">On The Way</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(true)}
              className="flex-1 flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Job
            </Button>

            <DeleteJobDialog 
              job={job} 
              onUpdate={onUpdate}
            />
          </div>
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