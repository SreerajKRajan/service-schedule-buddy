import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Users, RotateCcw } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  default_duration: number | null;
  default_price: number | null;
  active: boolean;
}

interface CreateJobFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function CreateJobForm({ onSuccess, onCancel }: CreateJobFormProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
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
    price: "",
    is_recurring: false,
    frequency: "daily",
    recurrence_count: 1,
    assigned_users: [] as string[],
    first_time: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchServices();
  }, []);

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

  const handleServiceChange = (serviceId: string) => {
    const selectedService = services.find(s => s.id === serviceId);
    if (selectedService) {
      setFormData(prev => ({
        ...prev,
        job_type: selectedService.name,
        estimated_duration: selectedService.default_duration?.toString() || prev.estimated_duration,
        price: selectedService.default_price?.toString() || prev.price,
      }));
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

    setLoading(true);
    try {
      if (formData.is_recurring && formData.scheduled_date) {
        // Generate multiple jobs for recurring schedule
        const startDate = new Date(formData.scheduled_date);
        const jobDates = generateRecurringJobs(startDate, formData.frequency, formData.recurrence_count);
        
        const jobsToCreate = jobDates.map((date, index) => ({
          title: `${formData.title}${index > 0 ? ` (${index + 1})` : ''}`,
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
          is_recurring: index === 0, // Only mark the first job as the parent recurring job
          first_time: formData.first_time && index === 0, // Only mark the first job as first time
          status: 'pending' as const,
        }));

        // Insert all jobs
        const { data: jobs, error: jobError } = await supabase
          .from('jobs')
          .insert(jobsToCreate)
          .select();

        if (jobError) throw jobError;

        // Create job assignments for all jobs
        if (formData.assigned_users.length > 0 && jobs) {
          const assignments = jobs.flatMap(job => 
            formData.assigned_users.map(userId => ({
              job_id: job.id,
              user_id: userId,
            }))
          );

          const { error: assignError } = await supabase
            .from('job_assignments')
            .insert(assignments);

          if (assignError) throw assignError;
        }

        // Create schedule record for the parent job (first one)
        if (jobs && jobs[0]) {
          const { error: scheduleError } = await supabase
            .from('job_schedules')
            .insert({
              job_id: jobs[0].id,
              frequency: formData.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
              interval_value: 1,
              next_due_date: jobDates[jobDates.length - 1]?.toISOString() || null,
              is_active: true,
            });

          if (scheduleError) throw scheduleError;
        }

        toast({
          title: "Success",
          description: `Created ${jobsToCreate.length} recurring jobs successfully`,
        });
      } else {
        // Create single job
        const jobData = {
          title: formData.title,
          description: formData.description || null,
          job_type: formData.job_type,
          priority: formData.priority,
          estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null,
          scheduled_date: formData.scheduled_date || null,
          customer_name: formData.customer_name || null,
          customer_address: formData.customer_address || null,
          customer_phone: formData.customer_phone || null,
          customer_email: formData.customer_email || null,
          notes: formData.notes || null,
          price: formData.price ? parseFloat(formData.price) : null,
          is_recurring: false,
          first_time: formData.first_time,
          status: 'pending' as const,
        };

        const { data: job, error: jobError } = await supabase
          .from('jobs')
          .insert(jobData)
          .select()
          .single();

        if (jobError) throw jobError;

        // Create job assignments
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
          description: "Job created successfully",
        });
      }

      // Reset form
      setFormData({
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
        price: "",
        is_recurring: false,
        frequency: "daily",
        recurrence_count: 1,
        assigned_users: [],
        first_time: false,
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating job:', error);
      toast({
        title: "Error",
        description: "Failed to create job",
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Window cleaning for office building"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job_type">Service Type *</Label>
          <Select
            value={services.find(s => s.name === formData.job_type)?.id || ""}
            onValueChange={handleServiceChange}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a service type" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                  {service.description && (
                    <span className="text-muted-foreground ml-2">
                      - {service.description}
                    </span>
                  )}
                </SelectItem>
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
          placeholder="Detailed description of the job..."
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
            placeholder="2"
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
            placeholder="100.00"
          />
        </div>
      </div>

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
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                placeholder="(555) 123-4567"
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
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_address">Address</Label>
            <Textarea
              id="customer_address"
              value={formData.customer_address}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
              placeholder="123 Main St, City, State 12345"
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Job Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="first_time"
              checked={formData.first_time}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, first_time: checked as boolean }))}
            />
            <Label htmlFor="first_time">This is a first time job</Label>
          </div>
          
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
                  <Label htmlFor="recurrence_count">Number of Occurrences</Label>
                  <Input
                    id="recurrence_count"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.recurrence_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, recurrence_count: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes or special instructions..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Creating..." : "Create Job"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}