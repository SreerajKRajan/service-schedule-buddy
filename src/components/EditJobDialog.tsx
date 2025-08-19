import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, Users, RotateCcw } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface JobAssignment {
  user_id: string;
  users: {
    name: string;
  };
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
  created_at: string;
  updated_at: string;
  price: number;
}

interface EditJobDialogProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditJobDialog({ job, open, onOpenChange, onSuccess }: EditJobDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [jobSchedule, setJobSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    job_type: "",
    priority: 1,
    estimated_duration: "",
    scheduled_date: "",
    customer_name: "",
    customer_address: "",
    customer_phone: "",
    customer_email: "",
    notes: "",
    status: "",
    price: "",
    is_recurring: false,
    frequency: "weekly",
    interval_value: 1,
    next_due_date: "",
    end_date: "",
    assigned_users: [] as string[],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && job) {
      fetchUsers();
      fetchJobAssignments();
      fetchJobSchedule();
      populateFormData();
    }
  }, [open, job]);

  const populateFormData = () => {
    const scheduledDate = job.scheduled_date 
      ? new Date(job.scheduled_date).toISOString().slice(0, 16)
      : "";

    setFormData({
      title: job.title || "",
      description: job.description || "",
      job_type: job.job_type || "",
      priority: job.priority || 1,
      estimated_duration: job.estimated_duration?.toString() || "",
      scheduled_date: scheduledDate,
      customer_name: job.customer_name || "",
      customer_address: job.customer_address || "",
      customer_phone: job.customer_phone || "",
      customer_email: job.customer_email || "",
      notes: job.notes || "",
      status: job.status || "",
      price: job.price?.toString() || "",
      is_recurring: job.is_recurring || false,
      frequency: "weekly",
      interval_value: 1,
      next_due_date: "",
      end_date: "",
      assigned_users: [],
    });
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('active', true);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchJobAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          user_id,
          users (name)
        `)
        .eq('job_id', job.id);

      if (error) throw error;
      
      const assignments = data?.map(assignment => assignment.user_id) || [];
      setCurrentAssignments(assignments);
      setFormData(prev => ({ ...prev, assigned_users: assignments }));
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
      
      if (data) {
        setJobSchedule(data);
        setFormData(prev => ({
          ...prev,
          frequency: data.frequency,
          interval_value: data.interval_value,
          next_due_date: data.next_due_date ? new Date(data.next_due_date).toISOString().slice(0, 16) : "",
          end_date: data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : "",
        }));
      }
    } catch (error) {
      console.error('Error fetching job schedule:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Job title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update the job
      const jobData = {
        title: formData.title,
        description: formData.description,
        job_type: formData.job_type,
        priority: formData.priority,
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null,
        scheduled_date: formData.scheduled_date || null,
        customer_name: formData.customer_name || null,
        customer_address: formData.customer_address || null,
        customer_phone: formData.customer_phone || null,
        customer_email: formData.customer_email || null,
        notes: formData.notes || null,
        status: formData.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
        price: formData.price ? parseFloat(formData.price) : null,
        is_recurring: formData.is_recurring,
      };

      const { error: jobError } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', job.id);

      if (jobError) throw jobError;

      // Handle recurring schedule
      if (formData.is_recurring) {
        const scheduleData = {
          job_id: job.id,
          frequency: formData.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
          interval_value: formData.interval_value,
          next_due_date: formData.next_due_date || null,
          end_date: formData.end_date || null,
          is_active: true,
        };

        if (jobSchedule) {
          // Update existing schedule
          const { error: scheduleError } = await supabase
            .from('job_schedules')
            .update(scheduleData)
            .eq('id', jobSchedule.id);

          if (scheduleError) throw scheduleError;
        } else {
          // Create new schedule
          const { error: scheduleError } = await supabase
            .from('job_schedules')
            .insert(scheduleData);

          if (scheduleError) throw scheduleError;
        }
      } else {
        // If not recurring, deactivate any existing schedules
        const { error: deactivateError } = await supabase
          .from('job_schedules')
          .update({ is_active: false })
          .eq('job_id', job.id);

        if (deactivateError) throw deactivateError;
      }

      // Update assignments
      // First, remove all existing assignments
      const { error: deleteError } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', job.id);

      if (deleteError) throw deleteError;

      // Then, add new assignments
      if (formData.assigned_users.length > 0) {
        const assignments = formData.assigned_users.map(userId => ({
          job_id: job.id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from('job_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      toast({
        title: "Success",
        description: "Job updated successfully",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating job:', error);
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAssignment = (userId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      assigned_users: checked
        ? [...prev.assigned_users, userId]
        : prev.assigned_users.filter(id => id !== userId)
    }));
  };

  const jobTypes = [
    "Window Cleaning",
    "Gutter Cleaning",
    "Pressure Washing",
    "Landscaping",
    "Maintenance",
    "Repair",
    "Installation",
    "Other"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Job
          </DialogTitle>
          <DialogDescription>
            Update job details and assignments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_type">Job Type</Label>
              <Select value={formData.job_type} onValueChange={(value) => setFormData(prev => ({ ...prev, job_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {jobTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_duration">Duration (hours)</Label>
              <Input
                id="estimated_duration"
                type="number"
                min="0.5"
                step="0.5"
                value={formData.estimated_duration}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <Input
                id="scheduled_date"
                type="datetime-local"
                value={formData.scheduled_date}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Recurring Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked as boolean }))}
                />
                <Label htmlFor="is_recurring">This is a recurring job</Label>
              </div>

              {formData.is_recurring && (
                <div className="space-y-4 pl-6 border-l-2 border-muted">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select value={formData.frequency} onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border z-50">
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="interval_value">Repeat every</Label>
                      <Input
                        id="interval_value"
                        type="number"
                        min="1"
                        value={formData.interval_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, interval_value: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="next_due_date">Next Due Date</Label>
                      <Input
                        id="next_due_date"
                        type="datetime-local"
                        value={formData.next_due_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date (Optional)</Label>
                      <Input
                        id="end_date"
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Textarea
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assign Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {users.map(user => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={formData.assigned_users.includes(user.id)}
                      onCheckedChange={(checked) => handleUserAssignment(user.id, checked as boolean)}
                    />
                    <Label htmlFor={`user-${user.id}`} className="flex-1">
                      {user.name} ({user.role})
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Updating..." : "Update Job"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}