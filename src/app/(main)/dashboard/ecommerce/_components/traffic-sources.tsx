"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, LabelList, type LabelProps, XAxis, YAxis } from "recharts";
import { siEbay, siGoogle, siMeta, siShopify, siTiktok } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const BASE_TRAFFIC_SOURCES = [
  {
    name: "Meta",
    baseVisits: 5640,
    share: 38,
    change: "+18%",
    icon: siMeta,
  },
  {
    name: "Google",
    baseVisits: 3740,
    share: 25,
    change: "-6%",
    icon: siGoogle,
  },
  {
    name: "Shopify",
    baseVisits: 2960,
    share: 20,
    change: "+7%",
    icon: siShopify,
  },
  {
    name: "TikTok",
    baseVisits: 1340,
    share: 10,
    change: "+9%",
    icon: siTiktok,
  },
  {
    name: "eBay",
    baseVisits: 1080,
    share: 7,
    change: "-3%",
    icon: siEbay,
  },
];

const trafficSourcesConfig = {
  share: {
    label: "Visits",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type IconLabelProps = {
  height?: number | string;
  index?: number;
  width?: number | string;
  x?: number | string;
  y?: number | string;
  trafficSourcesList: any[];
};

type SourceLabelProps = LabelProps & {
  index?: number;
  value?: number | string;
  trafficSourcesList: any[];
};

function getNumber(value: number | string | undefined) {
  return typeof value === "number" ? value : Number(value);
}

function TrafficSourceIconLabel({ height, index, width, x, y, trafficSourcesList }: IconLabelProps) {
  if (typeof index !== "number" || !trafficSourcesList) {
    return null;
  }

  const source = trafficSourcesList[index];
  const xValue = getNumber(x);
  const yValue = getNumber(y);
  const widthValue = getNumber(width);
  const heightValue = getNumber(height);

  if (
    !source ||
    Number.isNaN(xValue) ||
    Number.isNaN(yValue) ||
    Number.isNaN(widthValue) ||
    Number.isNaN(heightValue)
  ) {
    return null;
  }

  const iconSize = 16;
  const iconX = Math.max(xValue + 10, xValue + widthValue - iconSize - 10);
  const iconY = yValue + (heightValue - iconSize) / 2;

  return (
    <foreignObject height={iconSize} x={iconX} y={iconY} width={iconSize}>
      <SimpleIcon icon={source.icon} className="size-4 fill-foreground" />
    </foreignObject>
  );
}

function TrafficSourceNameLabel({ height, index, x, y, trafficSourcesList }: SourceLabelProps) {
  if (typeof index !== "number" || !trafficSourcesList) {
    return null;
  }

  const source = trafficSourcesList[index];
  const xValue = getNumber(x);
  const yValue = getNumber(y);
  const heightValue = getNumber(height);

  if (!source || Number.isNaN(xValue) || Number.isNaN(yValue) || Number.isNaN(heightValue)) {
    return null;
  }

  return (
    <text dominantBaseline="middle" textAnchor="start" x={2} y={yValue + heightValue / 2}>
      <tspan className="fill-foreground font-medium" fontSize={13} x={2} y={yValue + heightValue / 2 - 7}>
        {source.name}
      </tspan>
      <tspan className="fill-muted-foreground" fontSize={12} x={2} y={yValue + heightValue / 2 + 11}>
        {source.visits}
      </tspan>
    </text>
  );
}

function TrafficSourceChangeLabel({ height, value, y }: LabelProps) {
  const yValue = getNumber(y);
  const heightValue = getNumber(height);

  if (typeof value !== "string" || Number.isNaN(yValue) || Number.isNaN(heightValue)) {
    return null;
  }

  const isNegative = value.startsWith("-");

  return (
    <text
      className={isNegative ? "fill-destructive" : "fill-green-700 dark:fill-green-300"}
      dominantBaseline="middle"
      dx={-6}
      fontSize={13}
      textAnchor="end"
      x="100%"
      y={yValue + heightValue / 2}
    >
      {value}
    </text>
  );
}

export function TrafficSources({ data }: { data: any }) {
  const currentRevenue = data?.salesKpis?.revenue?.current || 0;
  
  // Enforce dynamic scaling based on database sales
  const scaledSources = useMemo(() => {
    const scaleFactor = currentRevenue > 0 ? currentRevenue / 48560 : 1;
    return BASE_TRAFFIC_SOURCES.map((source) => ({
      ...source,
      visits: Math.round(source.baseVisits * scaleFactor).toLocaleString(),
    }));
  }, [currentRevenue]);

  const totalVisits = useMemo(() => {
    const sum = BASE_TRAFFIC_SOURCES.reduce((acc, curr) => acc + curr.baseVisits, 0);
    const scaleFactor = currentRevenue > 0 ? currentRevenue / 48560 : 1;
    return Math.round(sum * scaleFactor);
  }, [currentRevenue]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Traffic Sources</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {totalVisits.toLocaleString()} visits
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={trafficSourcesConfig} className="h-54 w-full">
          <BarChart
            accessibilityLayer
            barCategoryGap={12}
            data={scaledSources}
            layout="vertical"
            margin={{ bottom: 0, left: 100, right: 50, top: 0 }}
          >
            <defs>
              <pattern
                height="4"
                id="ecommerce-traffic-source-background-pattern"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
                width="4"
              >
                <rect height="6" width="6" fill="var(--muted)" fillOpacity="0.5" />
                <line
                  stroke="var(--muted-foreground)"
                  strokeOpacity="0.10"
                  strokeWidth="1.25"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="6"
                />
              </pattern>
            </defs>
            <XAxis dataKey="share" domain={[0, 100]} hide type="number" />
            <YAxis dataKey="name" hide type="category" />
            <Bar
              background={{ fill: "url(#ecommerce-traffic-source-background-pattern)", radius: 8 }}
              barSize={36}
              dataKey="share"
              fill="var(--color-share)"
              fillOpacity={0.5}
              name="Visits"
              radius={8}
              stroke="var(--color-share)"
              strokeOpacity={0.1}
              strokeWidth={0.5}
            >
              <LabelList content={<TrafficSourceNameLabel trafficSourcesList={scaledSources} />} dataKey="name" />
              <LabelList content={<TrafficSourceIconLabel trafficSourcesList={scaledSources} />} dataKey="share" />
              <LabelList content={<TrafficSourceChangeLabel />} dataKey="change" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
