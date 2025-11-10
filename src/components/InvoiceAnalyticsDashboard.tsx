import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, DollarSign, FileText, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";
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
    job_types: string[];
    previous_week_job_count: number;
    trend: 'up' | 'down' | 'same';
    trend_percentage: number;
    daily_breakdown: Array<{
      date: string;
      job_count: number;
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
    new Date(new Date().setMonth(new Date().getMonth() - 3))
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [status, setStatus] = useState("all");

  // Technician filters and sorting
  const [techSortBy, setTechSortBy] = useState("job_count");
  const [techSortOrder, setTechSortOrder] = useState("desc");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "chart" | "heatmap">("table");

  const fetchInvoiceAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (granularity) params.append("granularity", granularity);
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"));
      if (status && status !== "all") params.append("status", status);
      
      const response = await fetch(
        `https://quotenew.theservicepilot.com/api/invoice/invoices/analytics/?${params.toString()}`
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
        `https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/technician-schedule?${params.toString()}`
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
      await Promise.all([
        fetchInvoiceAnalytics(),
        fetchTechnicianSchedule()
      ]);
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-24 mt-2" />
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
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Granularity</Label>
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
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
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
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
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
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_invoices}</div>
            <p className="text-xs text-muted-foreground">
              {data.paid_unpaid_overview.paid.count} paid, {data.paid_unpaid_overview.unpaid.count} unpaid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.total_amount)}</div>
            <p className="text-xs text-muted-foreground">Total invoiced amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.total_paid)}</div>
            <p className="text-xs text-muted-foreground">
              {((data.summary.total_paid / data.summary.total_amount) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(data.summary.total_due)}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.overdue_count} overdue ({formatCurrency(data.summary.overdue_total)})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formatTrendData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="Paid" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="Unpaid" fill="hsl(24, 95%, 53%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {formatStatusData().map((entry, index) => {
                    const statusKey = Object.keys(data.status_distribution).find(
                      (key) => data.status_distribution[key].label === entry.name
                    );
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[statusKey || ""] || "hsl(215, 14%, 34%)"}
                      />
                    );
                  })}
                </Pie>
                <Tooltip formatter={(value, name, props) => [value, `${props.payload.name} (${formatCurrency(props.payload.amount)})`]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-right p-2 font-medium">Total Invoiced</th>
                  <th className="text-right p-2 font-medium">Invoices</th>
                  <th className="text-right p-2 font-medium">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.top_customers.map((customer, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{customer.contact_name}</td>
                    <td className="p-2 text-muted-foreground">{customer.contact_email}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(customer.total_invoiced)}</td>
                    <td className="p-2 text-right">{customer.invoices_count}</td>
                    <td className="p-2 text-right text-green-600">{formatCurrency(customer.total_paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Technician Schedule Section - Only show if data is available */}
      {technicianData && (
        <>
          {/* Technician Filters and Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Activities by Representative (Next 7 Days)</CardTitle>
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
                      {technicianData.technicians.map(tech => (
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
                      {Array.from(new Set(technicianData.technicians.flatMap(t => t.job_types))).map(type => (
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
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Technician</TableHead>
                          <TableHead className="text-right">Scheduled Jobs</TableHead>
                          <TableHead>Earliest Date</TableHead>
                          <TableHead className="text-right">Total Hours</TableHead>
                          <TableHead>Job Types</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {technicianData.technicians.map((tech) => (
                          <TableRow key={tech.id}>
                            <TableCell className="font-medium">{tech.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-medium">{tech.job_count}</span>
                                {tech.trend === 'up' && (
                                  <div className="flex items-center text-green-600">
                                    <ArrowUp className="h-4 w-4" />
                                    <span className="text-xs">+{tech.trend_percentage}%</span>
                                  </div>
                                )}
                                {tech.trend === 'down' && (
                                  <div className="flex items-center text-red-600">
                                    <ArrowDown className="h-4 w-4" />
                                    <span className="text-xs">{tech.trend_percentage}%</span>
                                  </div>
                                )}
                                {tech.trend === 'same' && (
                                  <div className="flex items-center text-muted-foreground">
                                    <Minus className="h-4 w-4" />
                                    <span className="text-xs">0%</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {tech.earliest_scheduled_date
                                ? new Date(tech.earliest_scheduled_date).toLocaleDateString()
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">{tech.total_hours}h</TableCell>
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
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
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
                <Card>
                  <CardHeader>
                    <CardTitle>Technician Workload Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(400, technicianData.technicians.length * 50)}>
                      <BarChart
                        data={technicianData.technicians}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={90} />
                        <Tooltip />
                        <Bar dataKey="job_count" fill="hsl(217, 91%, 60%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Workload Heatmap View */}
              {viewMode === "heatmap" && (
                <Card>
                  <CardHeader>
                    <CardTitle>7-Day Workload Heatmap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {technicianData.technicians.map((tech) => {
                        const maxJobs = Math.max(...tech.daily_breakdown.map(d => d.job_count), 1);
                        
                        return (
                          <div key={tech.id} className="space-y-1">
                            <div className="text-sm font-medium">{tech.name}</div>
                            <div className="flex gap-1">
                              {tech.daily_breakdown.map((day, idx) => {
                                const intensity = day.job_count / maxJobs;
                                const bgColor = day.job_count > 0 
                                  ? `rgba(59, 130, 246, ${Math.max(0.2, intensity)})` 
                                  : 'rgba(229, 231, 235, 1)';
                                
                                return (
                                  <div
                                    key={idx}
                                    className="flex-1 h-12 rounded flex items-center justify-center text-xs font-medium border"
                                    style={{ backgroundColor: bgColor }}
                                    title={`${format(new Date(day.date), 'MMM dd')}: ${day.job_count} jobs`}
                                  >
                                    {day.job_count > 0 && day.job_count}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Less</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(229, 231, 235, 1)' }} />
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.4)' }} />
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }} />
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.8)' }} />
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: 'rgba(59, 130, 246, 1)' }} />
                      </div>
                      <span>More</span>
                    </div>
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                      <p>
                        Total: {technicianData.summary.total_technicians} technicians with{" "}
                        {technicianData.summary.total_jobs} scheduled jobs
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  No scheduled jobs found for the next 7 days
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
