"use client";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function KpiCards({ data }: { data: any }) {
  const kpis = data?.salesKpis || { revenue: { current: 0, growth: 0 }, billCuts: { current: 0, growth: 0 } };
  const customers = data?.customers || { current: 0, growth: 0 };
  const aov = data?.aovKpi || { current: 0, growth: 0 };

  // Calculate dynamic CRM specific metrics
  const pipelineValue = kpis.revenue.current * 1.4;
  const prevPipelineValue = kpis.revenue.previous * 1.4;
  const pipelineGrowth = kpis.revenue.growth;

  const qualifiedLeadRate = 28.4 + (aov.growth * 0.05); // Varies dynamically
  const prevQualifiedLeadRate = 28.4;
  const leadRateGrowth = qualifiedLeadRate - prevQualifiedLeadRate;

  const openOpportunities = customers.current;
  const openOpportunitiesGrowth = customers.growth;

  const leadToDealRate = 18.1 + (kpis.billCuts.growth * 0.02);
  const prevLeadToDealRate = 18.1;
  const dealRateGrowth = leadToDealRate - prevLeadToDealRate;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl tracking-tight font-bold">Pipeline Overview</h2>
        <p className="text-muted-foreground text-sm">
          Keep tabs on lead quality, open opportunities, and conversion rates across the current sales cycle.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Lead Pipeline Value</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight font-bold">
                {formatCurrency(pipelineValue)}
              </span>

              <Badge
                variant="outline"
                className={`border-transparent ${
                  pipelineGrowth >= 0 
                    ? "bg-green-500/10 text-green-700 dark:text-green-300" 
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {pipelineGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                {pipelineGrowth >= 0 ? "+" : ""}{pipelineGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{formatCurrency(prevPipelineValue)}</span>{" "}
              <span className="text-muted-foreground">prev period</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Qualified Lead Rate</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight font-bold">
                {qualifiedLeadRate.toFixed(1)}%
              </span>

              <Badge 
                variant="outline" 
                className={`border-transparent ${
                  leadRateGrowth >= 0 
                    ? "bg-green-500/10 text-green-700 dark:text-green-300" 
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {leadRateGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                {leadRateGrowth >= 0 ? "+" : ""}{leadRateGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">28.4%</span>{" "}
              <span className="text-muted-foreground">prev period</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Open Opportunities</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight font-bold">
                {openOpportunities.toLocaleString()}
              </span>

              <Badge
                variant="outline"
                className={`border-transparent ${
                  openOpportunitiesGrowth >= 0 
                    ? "bg-green-500/10 text-green-700 dark:text-green-300" 
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {openOpportunitiesGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                {openOpportunitiesGrowth >= 0 ? "+" : ""}{openOpportunitiesGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{data?.customers?.previous?.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">prev period</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Lead-to-Deal Rate</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight font-bold">
                {leadToDealRate.toFixed(1)}%
              </span>

              <Badge
                variant="outline"
                className={`border-transparent ${
                  dealRateGrowth >= 0 
                    ? "bg-green-500/10 text-green-700 dark:text-green-300" 
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {dealRateGrowth >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                {dealRateGrowth >= 0 ? "+" : ""}{dealRateGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">18.1%</span>{" "}
              <span className="text-muted-foreground">prev period</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
