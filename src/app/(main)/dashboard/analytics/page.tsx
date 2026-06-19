"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BarChart3, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFilterStore } from "@/stores/founder/filter-store";
import { GlobalFilterBar } from "@/components/founder/global-filter-bar";

import { AnalyticsKpiStrip } from "./_components/analytics-kpi-strip";
import { AnalyticsToolbar } from "./_components/analytics-toolbar";
import { RealtimeVisitors } from "./_components/realtime-visitors";
import { TopPages } from "./_components/top-pages";
import { TopTrafficSources } from "./_components/top-traffic-sources";
import { TrafficQuality } from "./_components/traffic-quality";

// Import flag icons styling
import "@/styles/flag-icons/flags.css";

export default function Page() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitializedDateRange, setHasInitializedDateRange] = useState(false);
  
  const { startDate, endDate, store, category, brand, sku, setDateRange } = useFilterStore();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/sales/status");
        const json = await res.json();
        if (json.success) {
          setStatus(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch status", err);
      }
    };

    fetchStatus();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ startDate, endDate });
        if (store !== "All Stores") params.set("store", store);
        if (category !== "All Categories") params.set("category", category);
        if (brand !== "All Brands") params.set("brand", brand);
        if (sku) params.set("sku", sku);

        const res = await fetch(`/api/sales/dashboard-extended?${params.toString()}`);
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

  if (!status) {
    return <div className="p-8"><Skeleton className="h-[400px] w-full animate-pulse" /></div>;
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
        <Button size="lg" onClick={() => router.push("/dashboard/sales/upload")}>
          <Upload className="mr-2 size-5" />
          Upload Sales Data
        </Button>
      </div>
    );
  }

  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 pt-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight font-bold">Web Analytics</h1>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/dashboard/sales/upload")}>
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-12 mt-2">
          <Skeleton className="h-[120px] xl:col-span-12 rounded-xl animate-pulse" />
          <Skeleton className="h-[250px] xl:col-span-7 rounded-xl animate-pulse" />
          <Skeleton className="h-[250px] xl:col-span-5 rounded-xl animate-pulse" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="conversions">Conversions</TabsTrigger>
            </TabsList>

            <AnalyticsToolbar />
          </div>

          <TabsContent value="overview" className="flex flex-col gap-4">
            <AnalyticsKpiStrip data={data} />

            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TrafficQuality data={data} />
              </div>
              <div className="xl:col-span-5">
                <RealtimeVisitors />
              </div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TopPages data={data} />
              </div>
              <div className="xl:col-span-5 xl:col-start-8">
                <TopTrafficSources data={data} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audience">
            <div className="flex h-64 items-center justify-center rounded-xl border border-border border-dashed text-muted-foreground">
              Audience view coming soon.
            </div>
          </TabsContent>

          <TabsContent value="acquisition">
            <div className="flex h-64 items-center justify-center rounded-xl border border-border border-dashed text-muted-foreground">
              Acquisition view coming soon.
            </div>
          </TabsContent>

          <TabsContent value="engagement">
            <div className="flex h-64 items-center justify-center rounded-xl border border-border border-dashed text-muted-foreground">
              Engagement view coming soon.
            </div>
          </TabsContent>

          <TabsContent value="conversions">
            <div className="flex h-64 items-center justify-center rounded-xl border border-border border-dashed text-muted-foreground">
              Conversions view coming soon.
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
