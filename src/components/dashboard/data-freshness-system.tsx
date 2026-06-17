"use client";

import { useEffect, useState } from "react";
import { Clock, Calendar, Database, AlertCircle } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FreshnessData {
  latestSaleDate: string | null;
  lastUploadedAt: string | null;
  dataAgeDays: number | null;
}

export function DataFreshnessSystem() {
  const [data, setData] = useState<FreshnessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/data-freshness");
        const json = await res.json();
        
        if (json.success) {
          setData(json.data);
          setError(null);
        } else {
          setError("Failed to load freshness data");
        }
      } catch (err) {
        console.error("Failed to fetch data freshness:", err);
        setError("Network error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Lightweight polling every 5 minutes (300,000 ms)
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
    return <Skeleton className="h-6 w-24 rounded-full" />;
  }

  // Determine badge styling and text based on age
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let badgeText = "Loading...";
  let badgeColorClass = "";

  if (error) {
    badgeVariant = "destructive";
    badgeText = "Data Error";
  } else if (!data?.latestSaleDate) {
    badgeVariant = "secondary";
    badgeText = "No Data";
  } else if (data.dataAgeDays === 0) {
    badgeVariant = "outline";
    badgeText = "🟢 Fresh";
    badgeColorClass = "border-green-500/50 text-green-600 bg-green-500/10";
  } else if (data.dataAgeDays === 1) {
    badgeVariant = "outline";
    badgeText = "🟡 1 Day Old";
    badgeColorClass = "border-yellow-500/50 text-yellow-600 bg-yellow-500/10";
  } else if (data.dataAgeDays !== null && data.dataAgeDays > 1) {
    badgeVariant = "destructive";
    badgeText = `🔴 ${data.dataAgeDays} Days Old`;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="flex items-center outline-none transition-opacity hover:opacity-80">
          <Badge variant={badgeVariant} className={`cursor-pointer font-medium ${badgeColorClass}`}>
            {badgeText}
          </Badge>
        </button>
      </SheetTrigger>
      
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center">
            <Database className="mr-2 size-5 text-muted-foreground" />
            Data Source Status
          </SheetTitle>
          <SheetDescription>
            This dashboard is powered by daily Excel uploads. It is not a realtime system.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Sale Date</CardTitle>
              <Calendar className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.latestSaleDate ? format(new Date(data.latestSaleDate), "dd MMM yyyy") : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data?.dataAgeDays !== null && data?.dataAgeDays !== undefined ? (
                  data.dataAgeDays === 0 ? "Data is up to date" : 
                  `${data.dataAgeDays} day${data.dataAgeDays === 1 ? '' : 's'} behind current date`
                ) : (
                  "No data available"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Uploaded At</CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {data?.lastUploadedAt ? format(new Date(data.lastUploadedAt), "dd MMM yyyy, HH:mm") : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                The timestamp when the last spreadsheet was processed.
              </p>
            </CardContent>
          </Card>

          {data?.dataAgeDays !== null && data?.dataAgeDays !== undefined && data.dataAgeDays > 1 && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 flex items-start mt-4">
              <AlertCircle className="size-5 mr-2 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Stale Data Warning</p>
                <p className="opacity-90">The dashboard data is {data.dataAgeDays} days old. Please upload the latest sales sheet to update the metrics.</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
