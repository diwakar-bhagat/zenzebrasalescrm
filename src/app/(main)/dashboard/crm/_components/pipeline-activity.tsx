"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";

const pipelineChartConfig = {
  orders: {
    label: "Qualified Leads",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatMonthTick(value: string) {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return format(date, "d MMM");
  } catch {
    return value;
  }
}

function formatTooltipLabel(value: string) {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return format(date, "PPPP");
  } catch {
    return value;
  }
}

export function PipelineActivity({ data }: { data: any }) {
  const trends = data?.dailyTrends || [];

  const totalQualified = useMemo(() => {
    return trends.reduce((sum: number, item: any) => sum + (item.orders || 0), 0);
  }, [trends]);

  const discoveryCallsBooked = useMemo(() => {
    return Math.round(totalQualified * 0.48);
  }, [totalQualified]);

  const discoveryProgress = totalQualified > 0 ? Math.round((discoveryCallsBooked / totalQualified) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-12">
        <CardHeader>
          <CardTitle>Qualified Lead Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartContainer config={pipelineChartConfig} className="h-72 w-full lg:col-span-8">
              <BarChart data={trends} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barSize={38}>
                <defs>
                  <pattern
                    id="crm-qualified-pattern"
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--color-qualified)" fillOpacity="0.15" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="var(--color-qualified)"
                      strokeWidth="1.25"
                      strokeOpacity="0.40"
                    />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  interval="preserveEnd"
                  tickFormatter={(value) => formatMonthTick(String(value))}
                />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(value) => formatTooltipLabel(String(value))}
                    />
                  }
                />
                <Bar
                  dataKey="orders"
                  fill="url(#crm-qualified-pattern)"
                  radius={[8, 8, 0, 0]}
                  stroke="var(--color-qualified)"
                  strokeOpacity={0.5}
                  strokeWidth={0.5}
                />
              </BarChart>
            </ChartContainer>

            <div className="flex flex-col gap-5 rounded-lg p-4 lg:col-span-4">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-4xl tabular-nums leading-none font-bold">
                  {totalQualified.toLocaleString()} <span className="font-normal text-lg text-muted-foreground font-sans">leads</span>
                </div>
                <p className="text-muted-foreground text-sm">Total qualified leads captured from sales transactions in this period.</p>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">
                  Discovery Calls Booked
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="font-medium text-2xl tabular-nums leading-none">
                    {discoveryCallsBooked.toLocaleString()} <span className="font-normal text-muted-foreground text-sm">meetings</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {discoveryProgress}% of qualified leads booked a first call.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-0.5">
                  <Progress
                    value={discoveryProgress}
                    className="h-2.5 bg-chart-2/12 *:data-[slot='progress-indicator']:bg-chart-2"
                  />
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="font-medium tabular-nums">{discoveryCallsBooked} booked</div>
                    <div className="text-muted-foreground tabular-nums">{totalQualified} qualified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
