"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, LabelList, type LabelProps, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { growthFillClass } from "@/lib/growth-ui";

const trafficSourcesConfig = {
  share: {
    label: "Bill cuts",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type IconLabelProps = {
  height?: number | string;
  index?: number;
  width?: number | string;
  x?: number | string;
  y?: number | string;
  footfallRows: any[];
};

type SourceLabelProps = LabelProps & {
  index?: number;
  value?: number | string;
  footfallRows: any[];
};

function getNumber(value: number | string | undefined) {
  return typeof value === "number" ? value : Number(value);
}

function FootfallCountLabel({ height, index, width, x, y, footfallRows }: IconLabelProps) {
  if (typeof index !== "number" || !footfallRows) {
    return null;
  }

  const source = footfallRows[index];
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

  const labelX = Math.max(xValue + 44, xValue + widthValue - 48);
  const labelY = yValue + heightValue / 2;

  return (
    <text
      className="fill-foreground font-medium"
      dominantBaseline="middle"
      fontSize={13}
      textAnchor="middle"
      x={labelX}
      y={labelY}
    >
      {source.billCuts.toLocaleString()}
    </text>
  );
}

function TrafficSourceNameLabel({ height, index, x, y, footfallRows }: SourceLabelProps) {
  if (typeof index !== "number" || !footfallRows) {
    return null;
  }

  const source = footfallRows[index];
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
        {source.billCuts.toLocaleString()} bill cuts
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

  return (
    <text
      className={growthFillClass(Number(value))}
      dominantBaseline="middle"
      dx={-6}
      fontSize={13}
      textAnchor="end"
      x="100%"
      y={yValue + heightValue / 2}
    >
      {Number(value) >= 0 ? "+" : ""}{Number(value).toFixed(1)}%
    </text>
  );
}

export function TrafficSources({ data }: { data: any }) {
  const storePerformance = data?.storePerformance || [];

  const footfallRows = useMemo(() => {
    const totalBillCuts = storePerformance.reduce((acc: number, row: any) => acc + Number(row.billCuts ?? 0), 0);
    return storePerformance.map((row: any) => {
      const billCuts = Number(row.billCuts ?? 0);
      return {
        name: row.storeDisplayName || row.billedBy || "Store",
        billCuts,
        share: totalBillCuts > 0 ? Math.round((billCuts / totalBillCuts) * 100) : 0,
        growth: Number(row.billCutsGrowth ?? 0),
      };
    });
  }, [storePerformance]);

  const totalVisits = footfallRows.reduce((acc: number, row: any) => acc + row.billCuts, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Footfall Analysis</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {totalVisits.toLocaleString()} bill cuts
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
              data={footfallRows}
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
              <LabelList content={<TrafficSourceNameLabel footfallRows={footfallRows} />} dataKey="name" />
              <LabelList content={<FootfallCountLabel footfallRows={footfallRows} />} dataKey="share" />
              <LabelList content={<TrafficSourceChangeLabel />} dataKey="growth" />
            </Bar>
          </BarChart>
        </ChartContainer>
        <p className="mt-3 text-muted-foreground text-xs">
          Footfall is estimated from distinct bill cuts in the uploaded sales sheet.
        </p>
      </CardContent>
    </Card>
  );
}
