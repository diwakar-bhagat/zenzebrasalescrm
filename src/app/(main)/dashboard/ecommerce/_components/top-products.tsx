"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-5)"];

export function TopProducts({ data }: { data: any }) {
  const categoryPerformance = data?.categoryPerformance || [];
  const productPerformance = data?.productPerformance || [];
  const currentTotalRevenue = data?.salesKpis?.revenue?.current || 0;

  // Process category shares
  const categories = useMemo(() => {
    const totalCatRevenue = categoryPerformance.reduce((acc: number, curr: any) => acc + (curr.revenue || 0), 0);
    if (totalCatRevenue <= 0) return [];
    
    return categoryPerformance.slice(0, 3).map((cat: any, index: number) => {
      const share = Math.round((cat.revenue / totalCatRevenue) * 100);
      return {
        name: cat.category,
        share: share > 0 ? share : 1,
        color: COLORS[index % COLORS.length],
      };
    });
  }, [categoryPerformance]);

  // Process products list
  const products = useMemo(() => {
    return productPerformance.slice(0, 3).map((prod: any) => {
      const shareVal = currentTotalRevenue > 0 ? Math.round((Number(prod.current_revenue) / currentTotalRevenue) * 100) : 0;
      return {
        name: prod.productName,
        category: "Product SKU: " + prod.sku,
        share: `${shareVal}%`,
        sales: formatCurrency(Number(prod.current_revenue)),
      };
    });
  }, [productPerformance, currentTotalRevenue]);

  const topProductsShare = useMemo(() => {
    const topProdRevenue = productPerformance.slice(0, 3).reduce((acc: number, curr: any) => acc + Number(curr.current_revenue || 0), 0);
    if (currentTotalRevenue <= 0) return "0%";
    return `${Math.round((topProdRevenue / currentTotalRevenue) * 100)}%`;
  }, [productPerformance, currentTotalRevenue]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Products</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {topProductsShare} of sales
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <div aria-label="Sales by category" className="flex h-2 gap-1 overflow-hidden bg-muted rounded-full" role="img">
              {categories.map((category: any) => (
                <div
                  aria-hidden="true"
                  key={category.name}
                  style={{
                    backgroundColor: category.color,
                    width: `${category.share}%`,
                  }}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              {categories.map((category: any) => (
                <div className="flex items-center gap-1" key={category.name}>
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="text-muted-foreground text-xs">{category.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
          <div className="text-muted-foreground text-xs">Products</div>
          <div className="text-muted-foreground text-xs">Share</div>
          <div className="text-muted-foreground text-xs">Sales</div>

          {products.map((product: any) => (
            <div className="contents text-sm" key={product.name}>
              <div className="min-w-0">
                <div className="truncate font-medium">{product.name}</div>
                <div className="text-muted-foreground text-xs">{product.category}</div>
              </div>
              <div className="self-center text-muted-foreground tabular-nums">{product.share}</div>
              <div className="self-center font-medium tabular-nums">{product.sales}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
