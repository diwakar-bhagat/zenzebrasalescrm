"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

export function IncomeBreakdown({ data }: { data: any }) {
  const categoryPerformance = data?.categoryPerformance || [];

  const processedCategories = useMemo(() => {
    const totalCatRevenue = categoryPerformance.reduce((acc: number, curr: any) => acc + (curr.revenue || 0), 0);
    if (totalCatRevenue <= 0) {
      return [
        { name: "Retail sales", share: 100, amount: 0, fillClass: "bg-chart-3" },
        { name: "Direct wholesale", share: 0, amount: 0, fillClass: "bg-chart-3/75" },
        { name: "Online marketplace", share: 0, amount: 0, fillClass: "bg-chart-3/50" },
      ];
    }

    const first = categoryPerformance[0];
    const second = categoryPerformance[1];
    
    const firstAmount = first?.revenue || 0;
    const secondAmount = second?.revenue || 0;
    const thirdAmount = Math.max(0, totalCatRevenue - firstAmount - secondAmount);

    const firstShare = Math.round((firstAmount / totalCatRevenue) * 100);
    const secondShare = Math.round((secondAmount / totalCatRevenue) * 100);
    const thirdShare = Math.max(0, 100 - firstShare - secondShare);

    return [
      {
        name: first?.category || "Top Category",
        share: firstShare,
        amount: firstAmount,
        fillClass: "bg-chart-3",
      },
      {
        name: second?.category || "Second Category",
        share: secondShare,
        amount: secondAmount,
        fillClass: "bg-chart-3/75",
      },
      {
        name: "Other Categories",
        share: thirdShare,
        amount: thirdAmount,
        fillClass: "bg-chart-3/50",
      },
    ];
  }, [categoryPerformance]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Income sources (Category Sales)</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-1 md:grid-cols-3">
        {processedCategories.map((cat, index) => (
          <section key={index} className="isolate flex gap-[0.5px]">
            <Separator
              orientation="vertical"
              className="mb-1 h-auto self-auto border-muted-foreground/50 border-l border-dashed bg-transparent"
            />
            <div className="flex min-h-24 flex-1 flex-col justify-between">
              <div className="flex min-w-0 flex-col gap-1 px-1">
                <p className="wrap-break-word text-muted-foreground text-xs leading-none">
                  {cat.name} · {cat.share}%
                </p>
                <div className="text-lg leading-none tracking-tight font-bold font-mono">{formatCurrency(cat.amount)}</div>
              </div>
              <div className={`-ml-0.5 h-5 rounded-sm ${cat.fillClass || "bg-chart-3"}`} />
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
