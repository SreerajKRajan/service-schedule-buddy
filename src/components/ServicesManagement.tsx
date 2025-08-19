import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  description: string | null;
  default_duration: number | null;
  default_price: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function ServicesManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_duration: "",
    default_price: "",
    active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      default_duration: "",
      default_price: "",
      active: true,
    });
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('services')
        .insert({
          name: formData.name,
          description: formData.description || null,
          default_duration: formData.default_duration ? parseInt(formData.default_duration) : null,
          default_price: formData.default_price ? parseFloat(formData.default_price) : null,
          active: formData.active,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service created successfully",
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error creating service:', error);
      toast({
        title: "Error",
        description: "Failed to create service",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      default_duration: service.default_duration?.toString() || "",
      default_price: service.default_price?.toString() || "",
      active: service.active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingService) return;

    try {
      const { error } = await supabase
        .from('services')
        .update({
          name: formData.name,
          description: formData.description || null,
          default_duration: formData.default_duration ? parseInt(formData.default_duration) : null,
          default_price: formData.default_price ? parseFloat(formData.default_price) : null,
          active: formData.active,
        })
        .eq('id', editingService.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingService(null);
      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service deleted successfully",
      });

      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  const ServiceForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Service Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter service name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Enter service description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="default_duration">Default Duration (hours)</Label>
          <Input
            id="default_duration"
            type="number"
            min="0"
            step="0.5"
            value={formData.default_duration}
            onChange={(e) => setFormData(prev => ({ ...prev, default_duration: e.target.value }))}
            placeholder="Hours"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_price">Default Price ($)</Label>
          <Input
            id="default_price"
            type="number"
            min="0"
            step="0.01"
            value={formData.default_price}
            onChange={(e) => setFormData(prev => ({ ...prev, default_price: e.target.value }))}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={formData.active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
        />
        <Label htmlFor="active">Active Service</Label>
      </div>

      <DialogFooter>
        <Button 
          onClick={onSubmit}
          disabled={!formData.name.trim()}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-48"></div>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
              <div className="h-4 bg-muted rounded animate-pulse w-48"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Services Management</h2>
          <p className="text-muted-foreground">
            Manage your service types and their default settings
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Service</DialogTitle>
              <DialogDescription>
                Add a new service type with default settings
              </DialogDescription>
            </DialogHeader>
            <ServiceForm onSubmit={handleCreate} submitLabel="Create Service" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id} className={!service.active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  {service.description && (
                    <CardDescription className="mt-1">
                      {service.description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(service)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(service.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={service.active ? "default" : "secondary"}>
                    {service.active ? "Active" : "Inactive"}
                  </Badge>
                  {service.default_duration && (
                    <Badge variant="outline">
                      {service.default_duration}h
                    </Badge>
                  )}
                  {service.default_price && (
                    <Badge variant="outline">
                      ${service.default_price}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <div className="text-muted-foreground text-center">
              <h3 className="text-lg font-semibold mb-2">No services found</h3>
              <p>Create your first service to get started.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update service details and default settings
            </DialogDescription>
          </DialogHeader>
          <ServiceForm onSubmit={handleUpdate} submitLabel="Update Service" />
        </DialogContent>
      </Dialog>
    </div>
  );
}