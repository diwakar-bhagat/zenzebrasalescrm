"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, type LabelProps, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const chartConfig = {
  visitors: {
    color: "var(--chart-1)",
    label: "Visitors",
  },
} satisfies ChartConfig;

type TrafficSourceDatum = {
  label: string;
  source: string;
  visitors: number;
};

const BASE_SOURCES_DATA = [
  { source: "Organic Search", baseVisitors: 89400 },
  { source: "Direct", baseVisitors: 55200 },
  { source: "Social", baseVisitors: 38100 },
  { source: "Referral", baseVisitors: 30400 },
  { source: "Paid Channel", baseVisitors: 22700 },
];

const BASE_CAMPAIGNS_DATA = [
  { source: "Spring Launch", baseVisitors: 16800 },
  { source: "Newsletter", baseVisitors: 12000 },
  { source: "Retargeting", baseVisitors: 7700 },
  { source: "Brand Search", baseVisitors: 5900 },
  { source: "Partners", baseVisitors: 4300 },
];

const BASE_REFERRERS_DATA = [
  { source: "Google", baseVisitors: 18400 },
  { source: "LinkedIn", baseVisitors: 8900 },
  { source: "Product Hunt", baseVisitors: 5700 },
  { source: "GitHub", baseVisitors: 4800 },
  { source: "Medium", baseVisitors: 3600 },
];

function TrafficSourceBarChart({ data }: { data: TrafficSourceDatum[] }) {
  const renderValueLabel = (props: LabelProps) => {
    const { height, value, y } = props;

    return (
      <text
        className="fill-foreground font-mono"
        dominantBaseline="middle"
        dx={-6}
        fontSize={13}
        textAnchor="end"
        x="100%"
        y={Number(y) + Number(height) / 2}
      >
        {value}
      </text>
    );
  };

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{
          left: 0,
          right: 48,
        }}
      >
        <CartesianGrid horizontal={false} vertical={false} />
        <YAxis dataKey="source" hide tickLine={false} tickMargin={10} type="category" />
        <XAxis dataKey="visitors" hide type="number" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Bar barSize={40} dataKey="visitors" fill="var(--color-visitors)" fillOpacity={0.5} radius={8}>
          <LabelList className="fill-foreground font-semibold" dataKey="source" fontSize={13} offset={12} position="insideLeft" />
          <LabelList content={renderValueLabel} dataKey="label" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function TopTrafficSources({ data }: { data: any }) {
  const currentRevenue = data?.salesKpis?.revenue?.current || 0;

  const { sources, campaigns, referrers } = useMemo(() => {
    const scaleFactor = currentRevenue > 0 ? currentRevenue / 48560 : 1;

    const scaleList = (list: typeof BASE_SOURCES_DATA) => {
      return list.map((item) => {
        const scaledVal = Math.round(item.baseVisitors * scaleFactor);
        const displayLabel = scaledVal >= 1000 
          ? `${(scaledVal / 1000).toFixed(1)}k` 
          : scaledVal.toString();
        return {
          source: item.source,
          visitors: scaledVal,
          label: displayLabel,
        };
      });
    };

    return {
      sources: scaleList(BASE_SOURCES_DATA),
      campaigns: scaleList(BASE_CAMPAIGNS_DATA),
      referrers: scaleList(BASE_REFERRERS_DATA),
    };
  }, [currentRevenue]);

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Traffic Sources Overview</CardTitle>
      </CardHeader>

      <CardContent className="px-0">
        <Tabs defaultValue="sources" className="flex flex-col gap-3">
          <TabsList className="w-full justify-start border-b px-2.5" variant="line">
            <TabsTrigger className="flex-none font-normal" value="sources">
              Sources
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="campaigns">
              Campaigns
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="referrers">
              Referrers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="px-4">
            <TrafficSourceBarChart data={sources} />
          </TabsContent>

          <TabsContent value="campaigns" className="px-4">
            <TrafficSourceBarChart data={campaigns} />
          </TabsContent>
          <TabsContent value="referrers" className="px-4">
            <TrafficSourceBarChart data={referrers} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
