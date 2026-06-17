"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Upload, TrendingUp, TrendingDown, ShoppingCart, DollarSign, BarChart3, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useFilterStore } from "@/stores/founder/filter-store";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";
import { DataFreshnessSystem } from "@/components/dashboard/data-freshness-system";

export default function FounderDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitializedDateRange, setHasInitializedDateRange] = useState(false);
  
  const { startDate, endDate, store, category, brand, sku, setDateRange } = useFilterStore();

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (status?.hasData && status.maxDate && !hasInitializedDateRange) {
      const end = new Date(`${status.maxDate}T00:00:00.000Z`);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);

      if (status.minDate) {
        const min = new Date(`${status.minDate}T00:00:00.000Z`);
        if (start < min) start.setTime(min.getTime());
      }

      setDateRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      setHasInitializedDateRange(true);
      return;
    }

    if (status?.hasData && hasInitializedDateRange) {
      fetchDashboardData();
    }
  }, [status, hasInitializedDateRange, startDate, endDate, store, category, brand, sku, setDateRange]);

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
      const params = new URLSearchParams({ startDate, endDate });
      if (store !== "All Stores") params.set("store", store);
      if (category !== "All Categories") params.set("category", category);
      if (brand !== "All Brands") params.set("brand", brand);
      if (sku) params.set("sku", sku);

      const res = await fetch(`/api/founder/dashboard?${params.toString()}`);
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

  if (!status.hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-6">
        <div className="bg-muted/30 p-8 rounded-full">
          <BarChart3 className="size-20 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold">Welcome to ZenZebra</h2>
          <p className="text-muted-foreground">No data has been uploaded yet. Upload your first daily sales sheet to unlock insights.</p>
        </div>
        <Button size="lg" onClick={() => router.push("/dashboard/founder/upload")}>
          <Upload className="mr-2 size-5" />
          Upload Sales Data
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 p-4 md:p-8 pt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Founder Dashboard</h2>
          <p className="text-muted-foreground mt-1">System of Attention</p>
        </div>
        <div className="flex items-center gap-3">
          <DataFreshnessSystem />
          <Button variant="outline" onClick={() => router.push("/dashboard/founder/upload")}>
            <Upload className="mr-2 size-4" />
            Upload Data
          </Button>
        </div>
      </div>

      <GlobalFilterBar 
        availableStores={status.availableStores || []}
        availableCategories={status.availableCategories || []}
        availableBrands={status.availableBrands || []}
      />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {["revenue", "bill-cuts", "units", "aov"].map((key) => (
            <Skeleton key={key} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Revenue Driver Section */}
          {data.revenueDriver && (
            <div className={`p-4 rounded-xl border flex items-center gap-4 ${
              data.revenueDriver.revenueStatus === "Up" ? "bg-green-500/10 border-green-500/20" : 
              data.revenueDriver.revenueStatus === "Down" ? "bg-red-500/10 border-red-500/20" : 
              "bg-muted/50 border-border"
            }`}>
              <div className="p-3 bg-background rounded-full shrink-0 shadow-sm">
                {data.revenueDriver.revenueStatus === "Up" ? <TrendingUp className="size-6 text-green-600" /> : 
                 data.revenueDriver.revenueStatus === "Down" ? <TrendingDown className="size-6 text-red-600" /> : 
                 <BarChart3 className="size-6 text-muted-foreground" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  Revenue is {data.revenueDriver.revenueStatus} 
                  <span className="text-sm font-normal opacity-80">
                    ({data.revenueDriver.revenueGrowth > 0 ? "+" : ""}{data.revenueDriver.revenueGrowth.toFixed(1)}%)
                  </span>
                </h3>
                <p className="text-sm opacity-90 font-medium mt-1">{data.revenueDriver.primaryDriver}</p>
              </div>
            </div>
          )}

          {/* 1. Daily Business Health (KPIs) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.salesKpis.revenue.current)}</div>
                <p className={`text-xs mt-1 flex items-center ${data.salesKpis.revenue.growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.salesKpis.revenue.growth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.salesKpis.revenue.growth > 0 ? "+" : ""}{data.salesKpis.revenue.growth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bill Cuts</CardTitle>
                <ShoppingCart className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.salesKpis.billCuts.current.toLocaleString()}</div>
                <p className={`text-xs mt-1 flex items-center ${data.salesKpis.billCuts.growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.salesKpis.billCuts.growth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.salesKpis.billCuts.growth > 0 ? "+" : ""}{data.salesKpis.billCuts.growth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
                <BarChart3 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.salesKpis.unitsSold.current.toLocaleString()}</div>
                <p className={`text-xs mt-1 flex items-center ${data.salesKpis.unitsSold.growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.salesKpis.unitsSold.growth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.salesKpis.unitsSold.growth > 0 ? "+" : ""}{data.salesKpis.unitsSold.growth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.aovKpi.current)}</div>
                <p className={`text-xs mt-1 flex items-center ${data.aovKpi.growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.aovKpi.growth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                  {data.aovKpi.growth > 0 ? "+" : ""}{data.aovKpi.growth.toFixed(1)}% vs prev
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Store Comparison */}
          {data.storePerformance && data.storePerformance.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Store Comparison</CardTitle>
                  <CardDescription>Which store is carrying the business?</CardDescription>
                </div>
                <Store className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 font-medium">Store</th>
                        <th className="px-4 py-3 font-medium text-right">Revenue</th>
                        <th className="px-4 py-3 font-medium text-right">Growth</th>
                        <th className="px-4 py-3 font-medium text-right">Contribution</th>
                        <th className="px-4 py-3 font-medium text-right">Bill Cuts</th>
                        <th className="px-4 py-3 font-medium text-right">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.storePerformance.map((store: any, idx: number) => (
                        <tr key={store.store || idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{store.store}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(store.revenue)}</td>
                          <td className={`px-4 py-3 text-right ${store.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {store.revenueGrowth > 0 ? "+" : ""}{store.revenueGrowth.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span>{store.contributionPercent.toFixed(1)}%</span>
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${store.contributionPercent}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">{store.billCuts.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(store.aov)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Category Performance */}
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
                      <YAxis tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Product Performance */}
            <Card className="lg:col-span-3">
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
          </div>
        </>
      )}
    </div>
  );
}
