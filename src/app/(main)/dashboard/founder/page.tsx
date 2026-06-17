"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  Legend, 
  Line, 
  LineChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Filter, Upload, TrendingUp, AlertCircle, ShoppingCart, DollarSign, BarChart3, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function FounderDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState("30");

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (status?.isSeeded) {
      fetchDashboardData();
    }
  }, [status, daysFilter]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/founder/status");
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch status", err);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/founder/dashboard?days=${daysFilter}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!status) {
    return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!status.isSeeded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-6">
        <div className="bg-muted/30 p-8 rounded-full">
          <BarChart3 className="size-20 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold">Welcome to Founder Dashboard</h2>
          <p className="text-muted-foreground">No data has been uploaded yet. Upload your first daily sales sheet to unlock insights.</p>
        </div>
        <Button size="lg" onClick={() => router.push("/dashboard/founder/upload")}>
          <Upload className="mr-2 size-5" />
          Upload Sales Data
        </Button>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Founder Dashboard</h2>
          <p className="text-muted-foreground mt-1">Executive overview of sales performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" title="More Filters">
            <Filter className="size-4" />
          </Button>
          <Button onClick={() => router.push("/dashboard/founder/upload")}>
            <Upload className="mr-2 size-4" />
            Upload Data
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* 1. Daily Business Health (KPIs) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.dailyHealth.currentRevenue)}</div>
                <p className={`text-xs mt-1 flex items-center ${data.dailyHealth.revenueGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.dailyHealth.revenueGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.dailyHealth.revenueGrowth > 0 ? "+" : ""}{data.dailyHealth.revenueGrowth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
                <ShoppingCart className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.dailyHealth.currentBills.toLocaleString()}</div>
                <p className={`text-xs mt-1 flex items-center ${data.dailyHealth.billsGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.dailyHealth.billsGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.dailyHealth.billsGrowth > 0 ? "+" : ""}{data.dailyHealth.billsGrowth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items Sold (Qty)</CardTitle>
                <BarChart3 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.dailyHealth.currentQuantity.toLocaleString()}</div>
                <p className={`text-xs mt-1 flex items-center ${data.dailyHealth.quantityGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.dailyHealth.quantityGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.dailyHealth.quantityGrowth > 0 ? "+" : ""}{data.dailyHealth.quantityGrowth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.aovAnalysis.current)}</div>
                <p className={`text-xs mt-1 flex items-center ${data.aovAnalysis.growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.aovAnalysis.growth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.aovAnalysis.growth > 0 ? "+" : ""}{data.aovAnalysis.growth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* 2. Category Performance */}
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Revenue breakdown by top categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryPerformance}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" />
                      <YAxis tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 3. Brand Performance */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Brand Market Share</CardTitle>
                <CardDescription>Revenue distribution across brands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.brandPerformance}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="revenue"
                        nameKey="brand"
                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {data.brandPerformance.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* 4. Product Performance */}
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Top Moving Items</CardTitle>
                <CardDescription>Best selling products by quantity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.productPerformance.map((item: any, i: number) => (
                    <div key={item.item || i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{item.item}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.revenue)} revenue
                        </p>
                      </div>
                      <div className="font-medium">
                        {item.quantity.toLocaleString()} sold
                      </div>
                    </div>
                  ))}
                  {data.productPerformance.length === 0 && (
                    <div className="text-sm text-muted-foreground py-4 text-center">No product data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 5. Bill Cut Analysis */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Bill Cut Analysis</CardTitle>
                <CardDescription>Number of bills processed per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.billCutAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getMonth()+1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      />
                      <Line type="monotone" dataKey="bills" stroke="#8b5cf6" strokeWidth={2} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
