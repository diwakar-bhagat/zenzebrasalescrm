import type { DashboardFilters } from "@/lib/founder/types";

import { calculateGrowth, type ComparisonPeriods } from "./comparison";

import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getAovKpi(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const result = await db`
    SELECT
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN net_amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN net_amount ELSE 0 END), 0) AS previous_revenue,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN bill_no END) AS current_bills,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN bill_no END) AS previous_bills
    FROM sales_fact
    WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
  `;

  const row = result[0] ?? {};
  const currentBills = numberValue(row.current_bills);
  const previousBills = numberValue(row.previous_bills);
  const current = currentBills > 0 ? numberValue(row.current_revenue) / currentBills : 0;
  const previous = previousBills > 0 ? numberValue(row.previous_revenue) / previousBills : 0;

  return {
    current,
    previous,
    growth: calculateGrowth(current, previous),
  };
}
