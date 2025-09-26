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
import { Badge } from "@/components/ui/badge";
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
  initialData?: {
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_address?: string;
    quoted_by?: string;
    scheduled_date?: string;
    first_time?: boolean;
    jobs_selected?: any[];
  };
  onJobCreated?: () => void;
}

export function CreateJobForm({ onSuccess, onCancel, initialData, onJobCreated }: CreateJobFormProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [serviceQuotedPrices, setServiceQuotedPrices] = useState<{ [serviceId: string]: { price: number; duration: number } }>({});
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    job_type: "",
    selected_services: [] as string[],
    priority: 1,
    estimated_duration: "2",
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
    quoted_by: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchServices();
  }, []);

  useEffect(() => {
    // Apply basic fields immediately (avoid waiting for services)
    if (initialData) {
      console.log('CreateJobForm initialData:', initialData);
      console.log('Scheduled date from initialData:', initialData.scheduled_date);
      
      const formattedDate = initialData.scheduled_date ? new Date(initialData.scheduled_date).toISOString().slice(0, 16) : "";
      console.log('Formatted date for input:', formattedDate);
      
      setFormData(prev => ({
        ...prev,
        customer_name: initialData.customer_name || "",
        customer_phone: initialData.customer_phone || "",
        customer_email: initialData.customer_email || "",
        customer_address: initialData.customer_address || "",
        scheduled_date: initialData.scheduled_date ? initialData.scheduled_date.slice(0, 16) : "",
        first_time: initialData.first_time || false,
        title: initialData.jobs_selected?.map(job => job.title || job.name).join(", ") || prev.title,
        job_type: initialData.jobs_selected?.map(job => job.name || job.title).join(", ") || prev.job_type,
        estimated_duration: initialData.jobs_selected?.reduce((sum, job) => sum + (job.duration ? Math.round(job.duration / 60) : 0), 0).toString() || prev.estimated_duration,
        price: initialData.jobs_selected?.reduce((sum, job) => sum + (job.price || 0), 0).toString() || prev.price,
      }));
    }
  }, [initialData]);

  // Separate useEffect to handle quoted_by after users are loaded
  useEffect(() => {
    if (initialData && initialData.quoted_by && users.length > 0) {
      // Verify the quoted_by user exists in the users list
      const quotedByUser = users.find(user => user.id === initialData.quoted_by);
      if (quotedByUser) {
        setFormData(prev => ({
          ...prev,
          quoted_by: initialData.quoted_by || "",
        }));
      }
    }
  }, [initialData, users]);

  useEffect(() => {
    if (initialData && services.length > 0) {
      // Match services from webhook data to database services
      const matchedServiceIds: string[] = [];
      const unmatchedServices: Array<{name: string; duration: number; price: number; id: string}> = [];
      const serviceQuotedPrices: { [serviceId: string]: { price: number; duration: number } } = {};
      
      if (initialData.jobs_selected) {
        initialData.jobs_selected.forEach(job => {
          const matchedService = services.find(service => 
            service.name.toLowerCase() === (job.name || job.title || '').toLowerCase() ||
            service.name.toLowerCase().includes((job.name || job.title || '').toLowerCase()) ||
            (job.name || job.title || '').toLowerCase().includes(service.name.toLowerCase())
          );
          
          if (matchedService) {
            matchedServiceIds.push(matchedService.id);
            // Store the actual quoted price and duration for this service
            serviceQuotedPrices[matchedService.id] = {
              price: job.price || matchedService.default_price || 0,
              duration: job.duration ? Math.round(job.duration / 60) : matchedService.default_duration || 0
            };
          } else {
            // Create custom service for unmatched webhook data
            const customService = {
              id: `custom-${Date.now()}-${Math.random()}`,
              name: job.title || job.name || 'Custom Service',
              duration: job.duration ? Math.round(job.duration / 60) : 1, // Convert minutes to hours
              price: job.price || 0
            };
            unmatchedServices.push(customService);
            matchedServiceIds.push(customService.id);
          }
        });
      }

      setCustomServices(unmatchedServices);
      setServiceQuotedPrices(serviceQuotedPrices);
      setFormData(prev => ({
        ...prev,
        selected_services: matchedServiceIds,
      }));
    }
  }, [initialData, services]);

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

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      const newSelectedServices = checked
        ? [...prev.selected_services, serviceId]
        : prev.selected_services.filter(id => id !== serviceId);
      
      // Initialize service price when adding a service
      if (checked) {
        const service = services.find(s => s.id === serviceId);
        const customService = customServices.find(s => s.id === serviceId);
        
        if (service) {
          const quotedPrice = serviceQuotedPrices[service.id];
          const defaultPrice = quotedPrice?.price ?? service.default_price ?? 0;
          setServicePrices(prevPrices => ({
            ...prevPrices,
            [serviceId]: defaultPrice
          }));
        } else if (customService) {
          setServicePrices(prevPrices => ({
            ...prevPrices,
            [serviceId]: customService.price || 0
          }));
        }
      } else {
        // Remove service price when unchecking
        setServicePrices(prevPrices => {
          const newPrices = { ...prevPrices };
          delete newPrices[serviceId];
          return newPrices;
        });
      }
      
      // Update job_type to be a comma-separated list of service names
      const allServices = [...services, ...customServices];
      const selectedServiceNames = allServices
        .filter(s => newSelectedServices.includes(s.id))
        .map(s => s.name)
        .join(", ");
      
      return {
        ...prev,
        selected_services: newSelectedServices,
        job_type: selectedServiceNames,
      };
    });
  };

  const handleServicePriceChange = (serviceId: string, price: string) => {
    const numPrice = parseFloat(price) || 0;
    setServicePrices(prev => ({
      ...prev,
      [serviceId]: numPrice
    }));
  };

  // useEffect to update total price when service prices change
  useEffect(() => {
    const total = Object.values(servicePrices).reduce((sum: number, price: number) => sum + price, 0);
    setFormData(prev => ({
      ...prev,
      price: total > 0 ? total.toString() : ""
    }));
  }, [servicePrices]);
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
        case 'quarterly':
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case 'semi_annually':
          currentDate.setMonth(currentDate.getMonth() + 6);
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
          is_recurring: true, // Mark ALL recurring jobs as recurring
          first_time: formData.first_time && index === 0, // Only mark the first job as first time
          status: 'pending' as const,
          quoted_by: formData.quoted_by || null,
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

        // Create job service relationships for all jobs
        if (formData.selected_services.length > 0 && jobs) {
          const jobServices = jobs.flatMap(job => {
            return formData.selected_services.map(serviceId => {
              // Find service details (either from services list or custom services)
              const service = services.find(s => s.id === serviceId);
              const customService = customServices.find(s => s.id === serviceId);
              
              if (service) {
                // Use quoted price if available, otherwise use default price
                const quotedPrice = serviceQuotedPrices[service.id];
                return {
                 job_id: job.id,
                 service_id: service.id,
                 service_name: service.name,
                 service_description: service.description,
                 price: servicePrices[service.id] ?? quotedPrice?.price ?? service.default_price,
                 duration: quotedPrice?.duration ?? service.default_duration,
                };
              } else if (customService) {
               return {
                 job_id: job.id,
                 service_id: customService.id,
                 service_name: customService.name,
                 service_description: null,
                 price: servicePrices[customService.id] ?? customService.price,
                 duration: customService.duration,
               };
              }
              return null;
            }).filter(Boolean);
          });

          const { error: servicesError } = await supabase
            .from('job_services')
            .insert(jobServices);

          if (servicesError) throw servicesError;
        }

        // Create schedule record for the parent job (first one)
        if (jobs && jobs[0]) {
          const { error: scheduleError } = await supabase
            .from('job_schedules')
            .insert({
              job_id: jobs[0].id,
              frequency: formData.frequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annually' | 'yearly',
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
          quoted_by: formData.quoted_by || null,
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

        // Create job service relationships
        if (formData.selected_services.length > 0) {
          const jobServices = formData.selected_services.map(serviceId => {
            // Find service details (either from services list or custom services)
            const service = services.find(s => s.id === serviceId);
            const customService = customServices.find(s => s.id === serviceId);
            
            if (service) {
              // Use quoted price if available, otherwise use default price
              const quotedPrice = serviceQuotedPrices[service.id];
              return {
                job_id: job.id,
                service_id: service.id,
                service_name: service.name,
                service_description: service.description,
                price: quotedPrice?.price ?? service.default_price,
                duration: quotedPrice?.duration ?? service.default_duration,
              };
            } else if (customService) {
              return {
                job_id: job.id,
                service_id: customService.id,
                service_name: customService.name,
                service_description: null,
                price: customService.price,
                duration: customService.duration,
              };
            }
            return null;
          }).filter(Boolean);

          const { error: servicesError } = await supabase
            .from('job_services')
            .insert(jobServices);

          if (servicesError) throw servicesError;
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
        selected_services: [],
        priority: 1,
        estimated_duration: "2",
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
        quoted_by: "",
      });

      // Call onJobCreated if provided (for quote conversion)
      if (onJobCreated) {
        onJobCreated();
      }

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
          <Label htmlFor="services">Services *</Label>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Database Services */}
                <div className="space-y-3">
                  {services.map(service => (
                    <div key={service.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={formData.selected_services.includes(service.id)}
                          onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <Label 
                              htmlFor={`service-${service.id}`} 
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {service.name}
                            </Label>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {service.default_duration && `Duration: ${service.default_duration}h`}
                            {service.default_duration && service.default_price && " • "}
                            {service.default_price && `Default: $${service.default_price}`}
                          </div>
                          {formData.selected_services.includes(service.id) && (
                            <div className="mt-2">
                              <Label className="text-xs text-muted-foreground">Price ($)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={servicePrices[service.id] || ''}
                                onChange={(e) => handleServicePriceChange(service.id, e.target.value)}
                                placeholder="Enter price"
                                className="mt-1 h-8"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Services */}
                {customServices.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Custom Services</h4>
                    <div className="space-y-3">
                      {customServices.map(service => (
                        <div key={service.id} className="border border-border rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id={`custom-service-${service.id}`}
                              checked={formData.selected_services.includes(service.id)}
                              onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <Label 
                                  htmlFor={`custom-service-${service.id}`} 
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {service.name}
                                  <Badge variant="secondary" className="ml-2 text-xs">Custom</Badge>
                                </Label>
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
                              <div className="text-xs text-muted-foreground mt-1">
                                Duration: {service.duration}h • Default: ${service.price}
                              </div>
                              {formData.selected_services.includes(service.id) && (
                                <div className="mt-2">
                                  <Label className="text-xs text-muted-foreground">Price ($)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={servicePrices[service.id] || ''}
                                    onChange={(e) => handleServicePriceChange(service.id, e.target.value)}
                                    placeholder="Enter price"
                                    className="mt-1 h-8"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
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
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annually">Semi Annually</SelectItem>
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