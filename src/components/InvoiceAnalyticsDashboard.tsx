import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react";
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
  const [locationId, setLocationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  const fetchInvoiceAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (granularity) params.append("granularity", granularity);
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"));
      if (status && status !== "all") params.append("status", status);
      if (locationId) params.append("location_id", locationId);
      if (customerId) params.append("customer_id", customerId);
      if (groupBy && groupBy !== "none") params.append("group_by", groupBy);
      
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
      const response = await fetch(
        `https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/technician-schedule?days_ahead=7`
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

            <div className="space-y-2">
              <Label>Location ID</Label>
              <Input
                placeholder="Enter location ID"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Customer ID</Label>
              <Input
                placeholder="Enter customer ID"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
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
        <Card>
          <CardHeader>
            <CardTitle>Sales Activities by Representative (Next 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {technicianData.technicians.length > 0 ? (
              <>
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
                        <TableCell className="text-right">{tech.job_count}</TableCell>
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
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No scheduled jobs found for the next 7 days
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
