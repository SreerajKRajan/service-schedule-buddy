import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";

interface InvoiceAnalytics {
  granularity: string;
  start_date: string;
  end_date: string;
  summary: {
    total_invoices: number;
    total_amount: number;
    total_paid: number;
    total_overdue: number;
    average_invoice_value: number;
  };
  trend: Array<{
    period: string;
    invoice_count: number;
    total_amount: number;
    paid_amount: number;
    overdue_amount: number;
  }>;
  breakdown: {
    by_status: Record<string, number>;
    by_location?: Record<string, number>;
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function InvoiceAnalytics() {
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState("monthly");
  const { toast } = useToast();

  const fetchAnalytics = async (selectedGranularity: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('invoice-analytics', {
        body: { granularity: selectedGranularity }
      });

      if (error) throw error;

      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching invoice analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(granularity);
  }, [granularity]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No invoice data available</p>
        </CardContent>
      </Card>
    );
  }

  const statusData = Object.entries(analytics.breakdown.by_status).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Number(value)
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Invoice Analytics</h2>
          <p className="text-muted-foreground">
            {analytics.start_date} to {analytics.end_date}
          </p>
        </div>
        <Select value={granularity} onValueChange={setGranularity}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invoices</CardDescription>
            <CardTitle className="text-3xl">{analytics.summary.total_invoices}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">${analytics.summary.total_amount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid</CardDescription>
            <CardTitle className="text-3xl text-green-600">${analytics.summary.total_paid.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Overdue</CardDescription>
            <CardTitle className="text-3xl text-red-600">${analytics.summary.total_overdue.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Invoice amounts over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              total_amount: { label: "Total Amount", color: "hsl(var(--primary))" },
              paid_amount: { label: "Paid Amount", color: "hsl(var(--chart-2))" },
              overdue_amount: { label: "Overdue Amount", color: "hsl(var(--destructive))" },
            }}
            className="h-80"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="total_amount" fill="hsl(var(--primary))" name="Total Amount" />
                <Bar dataKey="paid_amount" fill="hsl(var(--chart-2))" name="Paid Amount" />
                <Bar dataKey="overdue_amount" fill="hsl(var(--destructive))" name="Overdue Amount" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Invoice amounts by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: { label: "Amount" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Average Invoice Card */}
        <Card>
          <CardHeader>
            <CardTitle>Average Invoice Value</CardTitle>
            <CardDescription>Mean invoice amount in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-center py-12">
              ${analytics.summary.average_invoice_value.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
