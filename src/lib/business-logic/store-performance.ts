import type { DashboardFilters } from "@/lib/founder/types";

import { calculateGrowth, type ComparisonPeriods } from "./comparison";

type FounderSql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getStorePerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const result = await db`
    SELECT
      store,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN net_amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN net_amount ELSE 0 END), 0) AS previous_revenue,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN bill_no END) AS current_bills,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN bill_no END) AS previous_bills,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN quantity ELSE 0 END), 0) AS current_qty
    FROM sales_fact
    WHERE store IS NOT NULL
      AND (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
    GROUP BY store
    ORDER BY current_revenue DESC
  `;

  const parsed = result.map((row) => {
    const revenue = numberValue(row.current_revenue);
    const billCuts = numberValue(row.current_bills);

    return {
      store: String(row.store || "Unknown"),
      revenue,
      revenueGrowth: calculateGrowth(revenue, numberValue(row.previous_revenue)),
      billCuts,
      billCutsGrowth: calculateGrowth(billCuts, numberValue(row.previous_bills)),
      units: numberValue(row.current_qty),
      aov: billCuts > 0 ? revenue / billCuts : 0,
    };
  });

  const totalRevenue = parsed.reduce((sum, store) => sum + store.revenue, 0);

  return parsed.map((store) => ({
    ...store,
    contributionPercent: totalRevenue > 0 ? (store.revenue / totalRevenue) * 100 : 0,
  }));
}
