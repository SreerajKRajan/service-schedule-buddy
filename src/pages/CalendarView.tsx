import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JobCalendar } from "@/components/JobCalendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateJobForm } from "@/components/CreateJobForm";

interface User {
  id: string;
  email: string;
  name: string;
}

interface JobAssignment {
  job_id: string;
  user_id: string;
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

interface AcceptedQuote {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  scheduled_date: string;
  jobs_selected: any;
  status: string;
  first_time: boolean;
  quoted_by?: string;
  ghl_contact_id?: string;
  appointment_id?: string;
  created_at: string;
}

const CalendarView = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("id");
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createJobData, setCreateJobData] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, assigneeFilter]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchJobs(), fetchUsers(), fetchAcceptedQuotes()]);
    setLoading(false);
  };

  const fetchJobs = async () => {
    try {
      if (userId) {
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .ilike("email", userId)
          .maybeSingle();

        if (!user) {
          setJobs([]);
          return;
        }

        // Use a join query instead of fetching all IDs and using .in()
        const { data, error } = await supabase
          .from("job_assignments")
          .select(`
            jobs (*)
          `)
          .eq("user_id", user.id);

        if (error) throw error;
        
        // Extract jobs from the join result
        const jobsData = data
          ?.map((assignment: any) => assignment.jobs)
          .filter(Boolean) || [];
        
        setJobs(jobsData);
        return;
      }

      // If no userId, fetch all jobs
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch jobs");
      console.error("Error fetching jobs:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchAcceptedQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from("accepted_quotes")
        .select("*")
        .neq("status", "converted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAcceptedQuotes(data || []);
    } catch (error: any) {
      console.error("Error fetching accepted quotes:", error);
    }
  };

  const filterJobs = () => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer_address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesType = typeFilter === "all" || job.job_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const handleConvertToJob = (quote: AcceptedQuote, onSuccess: () => void, onError: () => void) => {
    const jobsSelected = quote.jobs_selected || [];
    const serviceNames = jobsSelected.map((j: any) => j.service_name || j.name).join(", ");
    
    setCreateJobData({
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone,
      customer_email: quote.customer_email,
      customer_address: quote.customer_address,
      scheduled_date: quote.scheduled_date,
      first_time: quote.first_time,
      jobs_selected: quote.jobs_selected,
      ghl_contact_id: quote.ghl_contact_id,
      appointment_id: quote.appointment_id,
      quoted_by: quote.quoted_by,
    });
    setShowCreateForm(true);
  };

  const handleCreateJobSuccess = async () => {
    setShowCreateForm(false);
    setCreateJobData(null);
    await fetchData();
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">No user ID provided in URL</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  const filteredJobs = filterJobs();

  return (
    <div className="min-h-screen p-4">
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="service_due">Service Due</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="one-time">One-time</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setTypeFilter("all");
              setAssigneeFilter("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      <JobCalendar
        jobs={filteredJobs}
        quotes={acceptedQuotes}
        hideAcceptedQuotes={statusFilter !== "accepted_quotes"}
        onRefresh={fetchData}
        onConvertToJob={handleConvertToJob}
      />

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <CreateJobForm
            onSuccess={handleCreateJobSuccess}
            onCancel={() => setShowCreateForm(false)}
            initialData={createJobData}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
