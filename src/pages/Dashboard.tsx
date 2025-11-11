import InvoiceAnalyticsDashboard from "@/components/InvoiceAnalyticsDashboard";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Job Tracker Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your jobs, invoices, and technician schedules
          </p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <InvoiceAnalyticsDashboard />
      </main>
    </div>
  );
};

export default Dashboard;
