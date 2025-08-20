import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export function WebhookTester() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const testWebhook = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: {}
      });

      if (error) throw error;

      setTestResult(data);
      toast({
        title: "Test Complete",
        description: data.success ? "Webhook test successful!" : "Webhook test failed",
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Test webhook error:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test webhook",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const testJobNotification = async () => {
    setTesting(true);
    try {
      // Get the latest job
      const { data: jobs, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, scheduled_date, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (jobError) throw jobError;
      if (!jobs || jobs.length === 0) {
        toast({
          title: "No Jobs Found",
          description: "Create a job first to test notifications",
          variant: "destructive",
        });
        return;
      }

      const latestJob = jobs[0];
      
      const { data, error } = await supabase.functions.invoke('check-job-notification', {
        body: { jobId: latestJob.id }
      });

      if (error) throw error;

      setTestResult({
        ...data,
        job_info: latestJob
      });
      
      toast({
        title: "Job Notification Test Complete",
        description: data.message || "Check results below",
      });
    } catch (error) {
      console.error('Test job notification error:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test job notification",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Webhook Testing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testWebhook} 
            disabled={testing}
            variant="outline"
          >
            {testing ? "Testing..." : "Test Webhook Connection"}
          </Button>
          
          <Button 
            onClick={testJobNotification} 
            disabled={testing}
          >
            {testing ? "Testing..." : "Test Latest Job Notification"}
          </Button>
        </div>

        {testResult && (
          <div className="mt-4 p-4 bg-muted rounded-md">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? "Success" : "Failed"}
                </Badge>
                <span className="text-sm">{testResult.message}</span>
              </div>
              
              {testResult.job_info && (
                <div className="text-sm space-y-1">
                  <p><strong>Job:</strong> {testResult.job_info.title}</p>
                  <p><strong>Scheduled:</strong> {new Date(testResult.job_info.scheduled_date).toLocaleString()}</p>
                  <p><strong>Created:</strong> {new Date(testResult.job_info.created_at).toLocaleString()}</p>
                </div>
              )}
              
              <details className="text-xs">
                <summary className="cursor-pointer">Full Response</summary>
                <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}