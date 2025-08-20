import { useEffect, useState } from "react";
import { JobBoard } from "@/components/JobBoard";
import { CreateJobForm } from "@/components/CreateJobForm";
import { UserManagement } from "@/components/UserManagement";
import { ServicesManagement } from "@/components/ServicesManagement";
import { Dashboard } from "@/components/Dashboard";
import AcceptedQuotes from "@/components/AcceptedQuotes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, BarChart3, Briefcase, Settings, FileCheck } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createJobData, setCreateJobData] = useState<any>(null);

  useEffect(() => {
    // Initialize any real-time subscriptions or data fetching here
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Job Tracker</h1>
            <p className="text-muted-foreground mt-2">Manage your service jobs efficiently</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Accepted Quotes
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Job
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard />
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <JobBoard />
          </TabsContent>

          <TabsContent value="quotes" className="space-y-6">
            <AcceptedQuotes 
              onConvertToJob={(quote) => {
                setCreateJobData({
                  customer_name: quote.customer_name,
                  customer_phone: quote.customer_phone,
                  customer_email: quote.customer_email,
                  customer_address: quote.customer_address,
                  quoted_by: quote.quoted_by,
                  first_time: quote.first_time,
                  jobs_selected: quote.jobs_selected,
                });
                setShowCreateForm(true);
              }}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <ServicesManagement />
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Job</CardTitle>
                <CardDescription>
                  Add a new service job to the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateJobForm onSuccess={() => setActiveTab("jobs")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showCreateForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Create New Job</CardTitle>
                <CardDescription>
                  Add a new service job to the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateJobForm 
                  onSuccess={() => {
                    setShowCreateForm(false);
                    setCreateJobData(null);
                    setActiveTab("jobs");
                  }}
                  onCancel={() => {
                    setShowCreateForm(false);
                    setCreateJobData(null);
                  }}
                  initialData={createJobData}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
