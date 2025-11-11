import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, DollarSign, FileText, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Minus, CheckCircle, Clock, AlertTriangle, File } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface InvoiceAnalyticsData {
  summary: {
    total_invoices: number;
    total_amount: number;
    total_paid: number;
    total_due: number;
    overdue_count: number;
    overdue_total: number;
  };
  paid_unpaid_overview: {
    paid: { count: number; total: number };
    unpaid: { count: number; total: number };
  };
  status_distribution: {
    [key: string]: {
      label: string;
      count: number;
      total: number;
    };
  };
  trends: Array<{
    period: string;
    total_invoices: number;
    total_amount: number;
    total_paid: number;
    total_due: number;
    paid_count: number;
    unpaid_count: number;
  }>;
  top_customers: Array<{
    contact_name: string;
    contact_email: string;
    total_invoiced: number;
    invoices_count: number;
    total_paid: number;
  }>;
}

interface TechnicianScheduleData {
  technicians: Array<{
    id: string;
    name: string;
    job_count: number;
    earliest_scheduled_date: string | null;
    total_hours: number;
    total_sales: number;
    job_types: string[];
    previous_week_job_count: number;
    trend: "up" | "down" | "same";
    trend_percentage: number;
    daily_breakdown: Array<{
      date: string;
      job_count: number;
      sales_amount: number;
    }>;
  }>;
  summary: {
    total_technicians: number;
    total_jobs: number;
    date_range: {
      start: string;
      end: string;
    };
  };
}

const STATUS_COLORS: { [key: string]: string } = {
  paid: "hsl(142, 76%, 36%)",
  unpaid: "hsl(24, 95%, 53%)",
  overdue: "hsl(0, 84%, 60%)",
  draft: "hsl(215, 14%, 34%)",
  sent: "hsl(217, 91%, 60%)",
  payment_processing: "hsl(48, 96%, 53%)",
  partially_paid: "hsl(38, 92%, 50%)",
  partial: "hsl(38, 92%, 50%)",
  void: "hsl(0, 0%, 45%)",
};

export default function InvoiceAnalyticsDashboard() {
  const [data, setData] = useState<InvoiceAnalyticsData | null>(null);
  const [technicianData, setTechnicianData] = useState<TechnicianScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [granularity, setGranularity] = useState("monthly");
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().setMonth(new Date().getMonth() - 3)),
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [status, setStatus] = useState("all");

  // Technician filters and sorting
  const [techSortBy, setTechSortBy] = useState("job_count");
  const [techSortOrder, setTechSortOrder] = useState("desc");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "chart" | "heatmap">("heatmap");

  const fetchInvoiceAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (granularity) params.append("granularity", granularity);
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"));
      if (status && status !== "all") params.append("status", status);

      const response = await fetch(
        `https://quotenew.theservicepilot.com/api/invoice/invoices/analytics/?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch invoice analytics");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching invoice analytics:", error);
      toast.error("Failed to load invoice analytics");
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicianSchedule = async () => {
    try {
      const params = new URLSearchParams();
      params.append("days_ahead", "7");
      params.append("sort_by", techSortBy);
      params.append("sort_order", techSortOrder);
      params.append("include_trends", "true");
      params.append("include_daily_breakdown", "true");

      if (technicianFilter !== "all") {
        params.append("technician_id", technicianFilter);
      }
      if (jobTypeFilter !== "all") {
        params.append("job_type", jobTypeFilter);
      }

      const response = await fetch(
        `https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/technician-schedule?${params.toString()}`,
      );

      if (!response.ok) {
        // Function might still be deploying, don't show error to user
        console.warn("Technician schedule endpoint not available yet (still deploying)");
        setTechnicianData(null);
        return;
      }

      const result = await response.json();
      setTechnicianData(result);
    } catch (error) {
      console.error("Error fetching technician schedule:", error);
      // Don't show error toast, just log it - function might still be deploying
      setTechnicianData(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchInvoiceAnalytics(), fetchTechnicianSchedule()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Refetch technician data when filters/sorting change
  useEffect(() => {
    fetchTechnicianSchedule();
  }, [techSortBy, techSortOrder, technicianFilter, jobTypeFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTrendData = () => {
    if (!data?.trends) return [];
    return data.trends.map((trend) => ({
      period: format(new Date(trend.period), "MMM yyyy"),
      Paid: trend.total_paid,
      Unpaid: trend.total_due,
    }));
  };

  const formatStatusData = () => {
    if (!data?.status_distribution) return [];
    return Object.entries(data.status_distribution)
      .filter(([_, value]) => value.count > 0)
      .map(([key, value]) => ({
        name: value.label,
        value: value.count,
        amount: value.total,
      }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="py-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Granularity</Label>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={fetchInvoiceAnalytics} className="w-full md:w-auto">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.total_invoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.paid_unpaid_overview.paid.count} paid • {data.paid_unpaid_overview.unpaid.count} unpaid
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-success/10 to-success/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {formatCurrency(data.summary.total_paid)}
            </div>
            <div className="mt-3">
              <Progress 
                value={(data.summary.total_paid / data.summary.total_amount * 100) || 0} 
                className="h-2 bg-success-light"
                indicatorClassName="bg-success"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {((data.summary.total_paid / data.summary.total_amount * 100) || 0).toFixed(1)}% collected
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-warning/10 to-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {formatCurrency(data.summary.total_due)}
            </div>
            <div className="mt-3">
              <Progress 
                value={(data.summary.total_due / data.summary.total_amount * 100) || 0} 
                className="h-2 bg-warning-light"
                indicatorClassName="bg-warning"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {((data.summary.total_due / data.summary.total_amount * 100) || 0).toFixed(1)}% pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-danger/10 to-danger/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Amount</CardTitle>
            <div className="h-10 w-10 rounded-full bg-danger/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-danger">
              {formatCurrency(data.summary.overdue_total)}
            </div>
            <div className="mt-3">
              <Progress 
                value={(data.summary.overdue_total / data.summary.total_amount * 100) || 0} 
                className="h-2 bg-danger-light"
                indicatorClassName="bg-danger"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.summary.overdue_count} overdue invoices
            </p>
          </CardContent>
        </Card>
      </div>

        {/* Status Distribution Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-success-light bg-success-light/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="h-12 w-12 rounded-lg bg-success flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Paid</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground">{data.paid_unpaid_overview.paid.count}</p>
                <p className="text-sm font-medium text-success">
                  {formatCurrency(data.paid_unpaid_overview.paid.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning-light bg-warning-light/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="h-12 w-12 rounded-lg bg-warning flex items-center justify-center flex-shrink-0">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Unpaid</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground">{data.paid_unpaid_overview.unpaid.count}</p>
                <p className="text-sm font-medium text-warning">
                  {formatCurrency(data.paid_unpaid_overview.unpaid.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-danger-light bg-danger-light/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="h-12 w-12 rounded-lg bg-danger flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Overdue</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground">{data.summary.overdue_count}</p>
                <p className="text-sm font-medium text-danger">
                  {formatCurrency(data.summary.overdue_total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-info-light bg-info-light/50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="h-12 w-12 rounded-lg bg-info flex items-center justify-center flex-shrink-0">
              <File className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Draft</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {data.status_distribution.draft?.count || 0}
                </p>
                <p className="text-sm font-medium text-info">
                  {formatCurrency(data.status_distribution.draft?.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Revenue Trends</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Paid vs Outstanding over time</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={formatTrendData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="period" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Paid" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Unpaid" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Invoice Status Distribution</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Breakdown by status</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={formatStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formatStatusData().map((entry, index) => {
                    const statusKey = Object.keys(data.status_distribution).find(
                      (key) => data.status_distribution[key].label === entry.name,
                    );
                    return <Cell key={`cell-${index}`} fill={STATUS_COLORS[statusKey || ""] || "hsl(215, 14%, 34%)"} />;
                  })}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    value,
                    `${props.payload.name} (${formatCurrency(props.payload.amount)})`,
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top Customers</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Highest revenue generating customers</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="text-right font-semibold">Total Invoiced</TableHead>
                  <TableHead className="text-right font-semibold">Invoices</TableHead>
                  <TableHead className="text-right font-semibold">Total Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_customers.map((customer, index) => (
                  <TableRow key={index} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">{customer.contact_name}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.contact_email}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(customer.total_invoiced)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{customer.invoices_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">{formatCurrency(customer.total_paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Technician Schedule Section - Only show if data is available */}
      {technicianData && (
        <>
          {/* Technician Filters and Controls */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Sales Activities by Representative (Next 7 Days)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Technician schedule and workload overview</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Sort By */}
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={techSortBy} onValueChange={setTechSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job_count">Scheduled Jobs</SelectItem>
                      <SelectItem value="earliest_date">Earliest Date</SelectItem>
                      <SelectItem value="name">Technician Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select value={techSortOrder} onValueChange={setTechSortOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">High to Low</SelectItem>
                      <SelectItem value="asc">Low to High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Technician Filter */}
                <div className="space-y-2">
                  <Label>Technician</Label>
                  <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Technicians" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Technicians</SelectItem>
                      {technicianData.technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Job Type Filter */}
                <div className="space-y-2">
                  <Label>Job Type</Label>
                  <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Job Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Job Types</SelectItem>
                      {Array.from(new Set(technicianData.technicians.flatMap((t) => t.job_types)))
                        .filter((type) => type && type.trim() !== "")
                        .map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* View Mode */}
                <div className="space-y-2">
                  <Label>View</Label>
                  <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="chart">Bar Chart</SelectItem>
                      <SelectItem value="heatmap">Heatmap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display based on view mode */}
          {technicianData.technicians.length > 0 ? (
            <>
              {/* Table View with Trends */}
              {viewMode === "table" && (
                <Card className="border-none shadow-sm">
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="font-semibold">Technician</TableHead>
                          <TableHead className="text-right font-semibold">Scheduled Jobs</TableHead>
                          <TableHead className="text-right font-semibold">Total Sales</TableHead>
                          <TableHead className="font-semibold">Earliest Date</TableHead>
                          <TableHead className="text-right font-semibold">Total Hours</TableHead>
                          <TableHead className="font-semibold">Job Types</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {technicianData.technicians.map((tech) => (
                          <TableRow key={tech.id} className="border-border hover:bg-muted/50">
                            <TableCell className="font-medium">{tech.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-semibold text-lg">{tech.job_count}</span>
                                {tech.trend === "up" && (
                                  <div className="flex items-center text-success">
                                    <ArrowUp className="h-4 w-4" />
                                    <span className="text-xs font-medium">+{tech.trend_percentage}%</span>
                                  </div>
                                )}
                                {tech.trend === "down" && (
                                  <div className="flex items-center text-danger">
                                    <ArrowDown className="h-4 w-4" />
                                    <span className="text-xs font-medium">{tech.trend_percentage}%</span>
                                  </div>
                                )}
                                {tech.trend === "same" && (
                                  <div className="flex items-center text-muted-foreground">
                                    <Minus className="h-4 w-4" />
                                    <span className="text-xs font-medium">0%</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-2xl text-success">
                                {formatCurrency(tech.total_sales)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {tech.earliest_scheduled_date
                                ? new Date(tech.earliest_scheduled_date).toLocaleDateString()
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right font-medium">{tech.total_hours}h</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {tech.job_types.slice(0, 3).map((type, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                                {tech.job_types.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{tech.job_types.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                      <p>
                        Total: {technicianData.summary.total_technicians} technicians with{" "}
                        {technicianData.summary.total_jobs} scheduled jobs
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Horizontal Bar Chart View */}
              {viewMode === "chart" && (
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Technician Workload Overview</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Job count by technician</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(400, technicianData.technicians.length * 50)}>
                      <BarChart
                        data={technicianData.technicians}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={90} 
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="job_count" fill="hsl(var(--info))" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Workload Heatmap View */}
              {viewMode === "heatmap" && (
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">7-Day Workload Heatmap</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Daily job distribution by technician</p>
                  </CardHeader>
                  <CardContent>
                    {/* Enhanced Legend */}
                    <div className="mb-6 bg-muted/30 rounded-lg p-4">
                      <p className="text-sm font-semibold mb-3 text-center">Job Load Intensity</p>
                      <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border border-border bg-muted"></div>
                          <span className="text-muted-foreground">No jobs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: 'hsl(var(--success) / 0.4)' }}></div>
                          <span className="text-muted-foreground">Light (1-2)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: 'hsl(var(--warning) / 0.6)' }}></div>
                          <span className="text-muted-foreground">Moderate (3-4)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: 'hsl(var(--danger) / 0.8)' }}></div>
                          <span className="text-muted-foreground">Heavy (5+)</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">Color intensity reflects workload level</p>
                    </div>

                    <div className="space-y-3 overflow-x-auto">
                      {technicianData.technicians.map((tech) => {
                        return (
                          <div key={tech.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold truncate">{tech.name}</div>
                              <div className="text-base text-success font-bold ml-2">
                                {formatCurrency(tech.total_sales)}
                              </div>
                            </div>
                            <div className="flex gap-1 min-w-max sm:min-w-0">
                              {tech.daily_breakdown.map((day, idx) => {
                                // Consistent color coding based on job count
                                let bgColor;
                                if (day.job_count === 0) {
                                  bgColor = 'hsl(var(--muted))';
                                } else if (day.job_count <= 2) {
                                  bgColor = 'hsl(var(--success) / 0.4)';
                                } else if (day.job_count <= 4) {
                                  bgColor = 'hsl(var(--warning) / 0.6)';
                                } else {
                                  bgColor = 'hsl(var(--danger) / 0.8)';
                                }

                                return (
                                  <div
                                    key={idx}
                                    className="flex-1 min-w-[60px] h-16 rounded-lg flex flex-col items-center justify-center text-xs font-medium border border-border transition-all hover:scale-105 cursor-pointer"
                                    style={{ backgroundColor: bgColor }}
                                    title={`${format(new Date(day.date), "MMM dd")}: ${day.job_count} jobs, ${formatCurrency(day.sales_amount)}`}
                                  >
                                    <div className="text-[10px] text-muted-foreground">{format(new Date(day.date), "MMM dd")}</div>
                                    {day.job_count > 0 && (
                                      <>
                                        <div className="font-bold text-sm">{day.job_count}</div>
                                        <div className="text-xs text-success font-bold">${day.sales_amount.toFixed(0)}</div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-none shadow-sm">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No scheduled jobs found for the next 7 days</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
