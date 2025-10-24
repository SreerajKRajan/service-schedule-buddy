import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ghl_contact_id?: string;
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
  const customServiceSectionRef = useRef<HTMLDivElement | null>(null);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [jobSchedule, setJobSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
    status: "",
    price: "",
    assigned_users: [] as string[],
    first_time: false,
    quoted_by: "",
    ghl_contact_id: "",
  });
  
  const [timeData, setTimeData] = useState({
    date: "",
    hour: "12",
    minute: "00",
    period: "PM" as "AM" | "PM"
  });
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && job) {
      fetchUsers();
      fetchServices();
    }
  }, [open, job]);

  // Separate useEffect to populate form data after all data is loaded
  useEffect(() => {
    if (open && job && services.length > 0 && users.length > 0) {
      populateFormData();
    }
  }, [open, job.id, job.price, job.updated_at, services.length, users.length]);

  const populateFormData = async () => {
    const scheduledDate = job.scheduled_date || "";

    // Parse the scheduled_date to extract date and time components
    if (job.scheduled_date) {
      const date = new Date(job.scheduled_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12; // Convert to 12-hour format
      
      setTimeData({
        date: dateStr,
        hour: String(hours),
        minute: minutes,
        period: period
      });
    }

    // Try to match job_type back to service IDs
    const selectedServiceIds: string[] = [];
    if (job.job_type && services.length > 0) {
      const jobTypeNames = job.job_type.split(', ').map(name => name.trim());
      jobTypeNames.forEach(jobTypeName => {
        const matchedService = services.find(service => 
          service.name.toLowerCase() === jobTypeName.toLowerCase() ||
          service.name.toLowerCase().includes(jobTypeName.toLowerCase()) ||
          jobTypeName.toLowerCase().includes(service.name.toLowerCase())
        );
        if (matchedService) {
          selectedServiceIds.push(matchedService.id);
        }
      });
    }

    // Fetch current assignments
    let assignedUsers: string[] = [];
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('user_id')
        .eq('job_id', job.id);

      if (error) throw error;
      assignedUsers = data?.map(assignment => assignment.user_id) || [];
      setCurrentAssignments(assignedUsers);
    } catch (error) {
      console.error('Error fetching job assignments:', error);
    }

    // Fetch current job services and their custom prices
    try {
      const { data, error } = await supabase
        .from('job_services')
        .select('service_id, price')
        .eq('job_id', job.id);

      if (error) throw error;
      
      // Set service prices from existing job services
      const existingServicePrices: Record<string, number> = {};
      data?.forEach(service => {
        if (service.service_id && service.price !== null) {
          existingServicePrices[service.service_id] = service.price;
        }
      });
      setServicePrices(existingServicePrices);
    } catch (error) {
      console.error('Error fetching job services:', error);
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
      first_time: job.first_time || false,
      assigned_users: assignedUsers,
      quoted_by: job.quoted_by || "",
      ghl_contact_id: job.ghl_contact_id || "",
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
    // This function is now integrated into populateFormData for better timing
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
    // Removed recurring schedule functionality
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
        status: (formData.status || job.status) as 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_the_way' | 'service_due',
        price: formData.price ? parseFloat(formData.price) : null,
        first_time: formData.first_time,
        quoted_by: formData.quoted_by || null,
        ghl_contact_id: formData.ghl_contact_id || null,
      };

      const { data: updatedJob, error: jobError } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', job.id)
        .select()
        .single();

      if (jobError) throw jobError;
      
      if (!updatedJob) {
        throw new Error('Failed to update job - no data returned');
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

      // First, create any custom services in the services table to get real UUIDs
      const customServiceIdMap: Record<string, string> = {};
      
      for (const customService of customServices) {
        if (formData.selected_services.includes(customService.id)) {
          const { data: newService, error: serviceCreateError } = await supabase
            .from('services')
            .insert({
              name: customService.name,
              description: null,
              default_duration: customService.duration,
              default_price: customService.price,
              active: true
            })
            .select()
            .single();

          if (serviceCreateError) throw serviceCreateError;
          
          if (newService) {
            // Map the temporary custom ID to the real UUID
            customServiceIdMap[customService.id] = newService.id;
          }
        }
      }

      // Update job services
      // First, remove all existing job services
      const { error: deleteServicesError } = await supabase
        .from('job_services')
        .delete()
        .eq('job_id', job.id);

      if (deleteServicesError) throw deleteServicesError;

      // Then, add new services with custom prices
      if (formData.selected_services.length > 0) {
        const jobServices = formData.selected_services.map(serviceId => {
          // Check if this is a custom service that was just created
          const realServiceId = customServiceIdMap[serviceId] || serviceId;
          
          // Find service details (either from services list or custom services)
          const service = services.find(s => s.id === realServiceId);
          const customService = customServices.find(s => s.id === serviceId);
          
          if (service) {
            return {
              job_id: job.id,
              service_id: service.id,
              service_name: service.name,
              service_description: service.description,
              price: servicePrices[serviceId] ?? service.default_price,
              duration: service.default_duration,
            };
          } else if (customService && customServiceIdMap[serviceId]) {
            // Use the real UUID for custom services
            return {
              job_id: job.id,
              service_id: customServiceIdMap[serviceId],
              service_name: customService.name,
              service_description: null,
              price: servicePrices[serviceId] ?? customService.price,
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
      
      // Initialize service price when adding a service
      if (checked) {
        const service = services.find(s => s.id === serviceId);
        const customService = customServices.find(s => s.id === serviceId);
        
        if (service) {
          const defaultPrice = service.default_price ?? 0;
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

  // Update total price when service prices change, but don't override
  // an existing price (e.g., one saved on the job already)
  useEffect(() => {
    const total = Object.values(servicePrices).reduce((sum: number, price: number) => sum + price, 0);
    setFormData(prev => {
      if (!prev.price) {
        return {
          ...prev,
          price: total > 0 ? total.toString() : ""
        };
      }
      return prev;
    });
  }, [servicePrices]);

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
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4 pr-4">
                      {/* Database Services */}
                      <div className="space-y-3">
                        {services.map((service) => (
                          <div key={service.id} className="border border-border rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <Checkbox
                                id={service.id}
                                checked={formData.selected_services.includes(service.id)}
                                onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor={service.id} className="text-sm font-medium cursor-pointer">
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

                      {/* End of services list */}
                    </div>
                  </ScrollArea>
                  {/* Add Custom Service Section - Outside scroll area */}
                  {showCustomServiceForm ? (
                    <div ref={customServiceSectionRef} className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium mb-3">Add Custom Service</h4>
                      <div className="grid gap-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <Input
                            placeholder="Service name"
                            value={customServiceData.name}
                            onChange={(e) => setCustomServiceData(prev => ({ ...prev, name: e.target.value }))}
                            autoFocus
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
                  ) : (
                    <div className="border-t pt-4 mt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowCustomServiceForm(true);
                          setTimeout(() => customServiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                        }}
                        className="w-full"
                      >
                        + Add Custom Service
                      </Button>
                    </div>
                  )}
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
              <Label htmlFor="scheduled_date">Scheduled Date & Time</Label>
              <div className="grid grid-cols-1 gap-2">
                <Input
                  id="scheduled_date"
                  type="date"
                  value={timeData.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setTimeData(prevTime => {
                      const updated = { ...prevTime, date: newDate };
                      
                      // Convert to ISO format for formData
                      if (newDate && updated.hour && updated.minute) {
                        let hour24 = parseInt(updated.hour);
                        if (updated.period === "PM" && hour24 !== 12) hour24 += 12;
                        if (updated.period === "AM" && hour24 === 12) hour24 = 0;
                        
                        const isoString = `${newDate}T${String(hour24).padStart(2, '0')}:${updated.minute}:00`;
                        setFormData(prev => ({ ...prev, scheduled_date: isoString }));
                      }
                      
                      return updated;
                    });
                  }}
                />
                <div className="grid grid-cols-4 gap-2">
                  <Select 
                    value={timeData.hour} 
                    onValueChange={(value) => {
                      setTimeData(prevTime => {
                        const updated = { ...prevTime, hour: value };
                        
                        // Convert to ISO format for formData
                        if (updated.date && updated.minute) {
                          let hour24 = parseInt(value);
                          if (updated.period === "PM" && hour24 !== 12) hour24 += 12;
                          if (updated.period === "AM" && hour24 === 12) hour24 = 0;
                          
                          const isoString = `${updated.date}T${String(hour24).padStart(2, '0')}:${updated.minute}:00`;
                          setFormData(prev => ({ ...prev, scheduled_date: isoString }));
                        }
                        
                        return updated;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={timeData.minute} 
                    onValueChange={(value) => {
                      setTimeData(prevTime => {
                        const updated = { ...prevTime, minute: value };
                        
                        // Convert to ISO format for formData
                        if (updated.date && updated.hour) {
                          let hour24 = parseInt(updated.hour);
                          if (updated.period === "PM" && hour24 !== 12) hour24 += 12;
                          if (updated.period === "AM" && hour24 === 12) hour24 = 0;
                          
                          const isoString = `${updated.date}T${String(hour24).padStart(2, '0')}:${value}:00`;
                          setFormData(prev => ({ ...prev, scheduled_date: isoString }));
                        }
                        
                        return updated;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="00">00</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="45">45</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={timeData.period} 
                    onValueChange={(value: "AM" | "PM") => {
                      setTimeData(prevTime => {
                        const updated = { ...prevTime, period: value };
                        
                        // Convert to ISO format for formData
                        if (updated.date && updated.hour && updated.minute) {
                          let hour24 = parseInt(updated.hour);
                          if (value === "PM" && hour24 !== 12) hour24 += 12;
                          if (value === "AM" && hour24 === 12) hour24 = 0;
                          
                          const isoString = `${updated.date}T${String(hour24).padStart(2, '0')}:${updated.minute}:00`;
                          setFormData(prev => ({ ...prev, scheduled_date: isoString }));
                        }
                        
                        return updated;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                  <Label htmlFor="ghl_contact_id">GHL Contact ID</Label>
                  <Input
                    id="ghl_contact_id"
                    value={formData.ghl_contact_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, ghl_contact_id: e.target.value }))}
                    placeholder="GoHighLevel contact ID"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                  />
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