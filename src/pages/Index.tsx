import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  const [searchParams] = useSearchParams();
  const customerEmail = searchParams.get('id');
  const isFiltered = !!customerEmail;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createJobData, setCreateJobData] = useState<any>(null);
  const [quoteConversionCallback, setQuoteConversionCallback] = useState<{ onSuccess: () => void; onError: () => void } | null>(null);

  useEffect(() => {
    // Set initial tab to jobs if filtered
    if (isFiltered) {
      setActiveTab("jobs");
      fetchUserRole();
    } else {
      setIsLoadingRole(false);
    }
  }, [isFiltered]);

  const fetchUserRole = async () => {
    if (!customerEmail) {
      setIsLoadingRole(false);
      return;
    }
    
    try {
      // Try to find user by email first (case-insensitive)
      let { data: user } = await supabase
        .from('users')
        .select('role')
        .ilike('email', customerEmail)
        .maybeSingle();
      
      // Fallback to name if email doesn't match
      if (!user) {
        const { data: userByName } = await supabase
          .from('users')
          .select('role')
          .eq('name', customerEmail)
          .maybeSingle();
        user = userByName;
      }
      
      setUserRole(user?.role || 'worker');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('worker');
    } finally {
      setIsLoadingRole(false);
    }
  };

  // Determine if user should have full access
  const hasFullAccess = !isFiltered || userRole === 'supervisor' || userRole === 'manager';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Job Tracker</h1>
            <p className="text-muted-foreground mt-2">
              {isFiltered 
                ? `Viewing jobs for ${customerEmail} ${userRole ? `(${userRole})` : ''}` 
                : "Manage your service jobs efficiently"
              }
            </p>
          </div>
        </div>

        {isLoadingRole ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {hasFullAccess ? (
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
            ) : (
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="jobs" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Jobs
                </TabsTrigger>
              </TabsList>
            )}

            {hasFullAccess && (
              <TabsContent value="dashboard" className="space-y-6">
                <Dashboard customerEmail={isFiltered ? customerEmail : null} />
              </TabsContent>
            )}

            <TabsContent value="jobs" className="space-y-6">
              <JobBoard 
                customerEmail={customerEmail} 
                userRole={userRole}
                hasFullAccess={hasFullAccess}
              />
            </TabsContent>

            {hasFullAccess && (
              <>
                <TabsContent value="quotes" className="space-y-6">
                  <AcceptedQuotes 
                    onConvertToJob={(quote, onSuccess, onError) => {
                      setCreateJobData({
                        customer_name: quote.customer_name,
                        customer_phone: quote.customer_phone,
                        customer_email: quote.customer_email,
                        customer_address: quote.customer_address,
                        quoted_by: quote.quoted_by,
                        scheduled_date: quote.scheduled_date,
                        first_time: quote.first_time,
                        jobs_selected: quote.jobs_selected,
                        ghl_contact_id: quote.ghl_contact_id,
                      });
                      setQuoteConversionCallback(() => ({
                        onSuccess,
                        onError
                      }));
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
              </>
            )}
          </Tabs>
        )}

        {showCreateForm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
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
                    setQuoteConversionCallback(null);
                    setActiveTab("jobs");
                  }}
                  onCancel={() => {
                    setShowCreateForm(false);
                    setCreateJobData(null);
                    setQuoteConversionCallback(null);
                  }}
                  onJobCreated={quoteConversionCallback?.onSuccess}
                  onJobCreatedError={quoteConversionCallback?.onError}
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