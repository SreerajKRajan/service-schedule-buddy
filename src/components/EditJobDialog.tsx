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
import { Badge } from "@/components/ui/badge";
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
  first_time: boolean;
  created_at: string;
  updated_at: string;
  price: number;
  quoted_by?: string;
}

interface EditJobDialogProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditJobDialog({ job, open, onOpenChange, onSuccess }: EditJobDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customServices, setCustomServices] = useState<Array<{
    name: string;
    duration: number;
    price: number;
    id: string;
  }>>([]);
  const [showCustomServiceForm, setShowCustomServiceForm] = useState(false);
  const [customServiceData, setCustomServiceData] = useState({
    name: "",
    duration: "",
    price: ""
  });
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [jobSchedule, setJobSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    job_type: "",
    selected_services: [] as string[],
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
    first_time: false,
    frequency: "weekly",
    interval_value: 1,
    next_due_date: "",
    end_date: "",
    recurrence_count: 1,
    assigned_users: [] as string[],
    quoted_by: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && job) {
      fetchUsers();
      fetchServices();
      fetchJobAssignments();
      fetchJobSchedule();
    }
  }, [open, job]);

  // Separate useEffect to populate form data after services are loaded
  useEffect(() => {
    if (open && job && services.length > 0) {
      populateFormData();
    }
  }, [open, job, services]);

  const populateFormData = () => {
    const scheduledDate = job.scheduled_date 
      ? new Date(job.scheduled_date).toISOString().slice(0, 16)
      : "";

    // Try to match job_type back to service IDs
    const selectedServiceIds: string[] = [];
    if (job.job_type && services.length > 0) {
      const jobTypeNames = job.job_type.split(', ').map(name => name.trim());
      jobTypeNames.forEach(jobTypeName => {
        const matchingService = services.find(service => 
          service.name.toLowerCase() === jobTypeName.toLowerCase()
        );
        if (matchingService) {
          selectedServiceIds.push(matchingService.id);
        }
      });
    }

    setFormData({
      title: job.title || "",
      description: job.description || "",
      job_type: job.job_type || "",
      selected_services: selectedServiceIds,
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
      first_time: job.first_time || false,
      frequency: "weekly",
      interval_value: 1,
      next_due_date: "",
      end_date: "",
      recurrence_count: 1,
      assigned_users: [],
      quoted_by: job.quoted_by || "",
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

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
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

  const addCustomService = () => {
    if (!customServiceData.name.trim()) {
      toast({
        title: "Error",
        description: "Service name is required",
        variant: "destructive",
      });
      return;
    }

    const customService = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customServiceData.name.trim(),
      duration: parseInt(customServiceData.duration) || 1,
      price: parseFloat(customServiceData.price) || 0
    };

    setCustomServices(prev => [...prev, customService]);
    setFormData(prev => ({
      ...prev,
      selected_services: [...prev.selected_services, customService.id]
    }));
    
    // Reset form
    setCustomServiceData({ name: "", duration: "", price: "" });
    setShowCustomServiceForm(false);
    
    toast({
      title: "Success",
      description: "Custom service added successfully",
    });
  };

  const removeCustomService = (serviceId: string) => {
    setCustomServices(prev => prev.filter(s => s.id !== serviceId));
    setFormData(prev => ({
      ...prev,
      selected_services: prev.selected_services.filter(id => id !== serviceId)
    }));
  };

  const fetchJobSchedule = async () => {
    if (!job.is_recurring) return;
    
    try {
      const { data, error } = await supabase
        .from('job_schedules')
        .select('*')
        .eq('job_id', job.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
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

  const generateRecurringJobs = (startDate: Date, frequency: string, occurrences: number) => {
    const jobs = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < occurrences; i++) {
      jobs.push(new Date(currentDate));
      
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
    }
    
    return jobs;
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

    if (formData.selected_services.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service",
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
        first_time: formData.first_time,
        quoted_by: formData.quoted_by || null,
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

        // If this job was previously non-recurring and now marked recurring, create additional jobs
        if (!job.is_recurring && formData.scheduled_date && formData.recurrence_count > 1) {
          const startDate = new Date(formData.scheduled_date);
          const jobDates = generateRecurringJobs(startDate, formData.frequency, formData.recurrence_count);
          
          // Create additional jobs (skip the first one as it's the current job)
          const additionalJobs = jobDates.slice(1).map((date, index) => ({
            title: `${formData.title} (${index + 2})`,
            description: formData.description || null,
            job_type: formData.job_type,
            priority: formData.priority,
            estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null,
            scheduled_date: date.toISOString(),
            customer_name: formData.customer_name || null,
            customer_address: formData.customer_address || null,
            customer_phone: formData.customer_phone || null,
            customer_email: formData.customer_email || null,
            notes: formData.notes || null,
            price: formData.price ? parseFloat(formData.price) : null,
            is_recurring: false, // Only the parent job is marked as recurring
            first_time: false,
            status: 'pending' as const,
            quoted_by: formData.quoted_by || null,
          }));

          if (additionalJobs.length > 0) {
            const { data: createdJobs, error: additionalJobsError } = await supabase
              .from('jobs')
              .insert(additionalJobs)
              .select();

            if (additionalJobsError) throw additionalJobsError;

            // Create assignments for the additional jobs
            if (formData.assigned_users.length > 0 && createdJobs) {
              const additionalAssignments = createdJobs.flatMap(job => 
                formData.assigned_users.map(userId => ({
                  job_id: job.id,
                  user_id: userId,
                }))
              );

              const { error: additionalAssignError } = await supabase
                .from('job_assignments')
                .insert(additionalAssignments);

              if (additionalAssignError) throw additionalAssignError;
            }
          }
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

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      const newSelectedServices = checked
        ? [...prev.selected_services, serviceId]
        : prev.selected_services.filter(id => id !== serviceId);
      
      // Update job_type to be a comma-separated list of service names
      const allServices = [...services, ...customServices];
      const selectedServiceNames = allServices
        .filter(s => newSelectedServices.includes(s.id))
        .map(s => s.name)
        .join(", ");
      
      // Calculate combined duration and price with proper type handling
      const selectedServicesData = allServices.filter(s => newSelectedServices.includes(s.id));
      const totalDuration = selectedServicesData.reduce((sum, service) => {
        if ('default_duration' in service) {
          return sum + (service.default_duration || 0);
        } else {
          return sum + (service.duration || 0);
        }
      }, 0);
      
      const totalPrice = selectedServicesData.reduce((sum, service) => {
        if ('default_price' in service) {
          return sum + (service.default_price || 0);
        } else {
          return sum + (service.price || 0);
        }
      }, 0);
      
      return {
        ...prev,
        selected_services: newSelectedServices,
        job_type: selectedServiceNames,
        estimated_duration: totalDuration > 0 ? totalDuration.toString() : prev.estimated_duration,
        price: totalPrice > 0 ? totalPrice.toString() : prev.price,
      };
    });
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
              <Label>Services *</Label>
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {/* Database Services */}
                    <div className="grid gap-3 md:grid-cols-2">
                      {services.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={service.id}
                            checked={formData.selected_services.includes(service.id)}
                            onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                          />
                          <Label htmlFor={service.id} className="text-sm font-normal cursor-pointer">
                            {service.name}
                            {service.default_duration && (
                              <span className="text-muted-foreground ml-1">
                                ({service.default_duration}h)
                              </span>
                            )}
                            {service.default_price && (
                              <span className="text-muted-foreground ml-1">
                                (${service.default_price})
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {/* Custom Services */}
                    {customServices.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">Custom Services</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          {customServices.map(service => (
                            <div key={service.id} className="flex items-start space-x-2">
                              <Checkbox
                                id={`custom-service-${service.id}`}
                                checked={formData.selected_services.includes(service.id)}
                                onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                              />
                              <div className="grid gap-1 leading-none flex-1">
                                <Label 
                                  htmlFor={`custom-service-${service.id}`} 
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {service.name}
                                  <Badge variant="secondary" className="ml-2 text-xs">Custom</Badge>
                                </Label>
                                <div className="text-xs text-muted-foreground">
                                  {service.duration}h • ${service.price}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCustomService(service.id)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive/90"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Custom Service Form */}
                    {showCustomServiceForm && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">Add Custom Service</h4>
                        <div className="grid gap-3">
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              placeholder="Service name"
                              value={customServiceData.name}
                              onChange={(e) => setCustomServiceData(prev => ({ ...prev, name: e.target.value }))}
                            />
                            <Input
                              type="number"
                              placeholder="Duration (hours)"
                              value={customServiceData.duration}
                              onChange={(e) => setCustomServiceData(prev => ({ ...prev, duration: e.target.value }))}
                            />
                            <Input
                              type="number"
                              placeholder="Price ($)"
                              value={customServiceData.price}
                              onChange={(e) => setCustomServiceData(prev => ({ ...prev, price: e.target.value }))}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" onClick={addCustomService} size="sm">
                              Add Service
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => {
                                setShowCustomServiceForm(false);
                                setCustomServiceData({ name: "", duration: "", price: "" });
                              }} 
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add Custom Service Button */}
                    {!showCustomServiceForm && (
                      <div className="border-t pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowCustomServiceForm(true)}
                          className="w-full"
                        >
                          + Add Custom Service
                        </Button>
                      </div>
                    )}

                    {formData.selected_services.length === 0 && (
                      <p className="text-sm text-destructive mt-2">Please select at least one service</p>
                    )}
                  </div>
                </CardContent>
              </Card>
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
              <CardTitle>Job Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="first_time"
                  checked={formData.first_time}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, first_time: checked as boolean }))}
                />
                <Label htmlFor="first_time">First time customer</Label>
              </div>
            </CardContent>
          </Card>

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

                  <div className="space-y-2">
                    <Label htmlFor="recurrence_count">Number of occurrences</Label>
                    <Input
                      id="recurrence_count"
                      type="number"
                      value={formData.recurrence_count}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurrence_count: parseInt(e.target.value) || 1 }))}
                      min="1"
                      placeholder="1"
                      className="bg-background border-border"
                    />
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
                Team Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quoted_by">Quoted By</Label>
                <Select value={formData.quoted_by} onValueChange={(value) => setFormData(prev => ({ ...prev, quoted_by: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member who quoted this job" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-50">
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Team Members</Label>
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