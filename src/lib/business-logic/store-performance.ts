import type { DashboardFilters } from "@/lib/founder/types";

import { calculateGrowth, type ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";

import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function retailFilter(filters: DashboardFilters) {
  return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getStorePerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const foodCategories = retailFilter(filters);

  const result = await db`
    WITH curr AS (
      SELECT store_display_name, billed_by, SUM(net_amount) AS revenue,
        COUNT(DISTINCT bill_no) AS bill_cuts, SUM(quantity) AS units
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY store_display_name, billed_by
    ),
    prev AS (
      SELECT billed_by, SUM(net_amount) AS revenue, COUNT(DISTINCT bill_no) AS bill_cuts
      FROM sales_fact_v
      WHERE sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY billed_by
    ),
    total_curr AS (SELECT SUM(revenue) AS total_rev FROM curr)
    SELECT c.store_display_name, c.billed_by, c.revenue AS current_revenue, c.bill_cuts AS current_bill_cuts,
      c.units AS current_units, p.revenue AS prev_revenue, p.bill_cuts AS prev_bill_cuts, t.total_rev
    FROM curr c LEFT JOIN prev p USING (billed_by) CROSS JOIN total_curr t ORDER BY c.revenue DESC
  `;

  return result.map((row) => {
    const revenue = numberValue(row.current_revenue);
    const billCuts = numberValue(row.current_bill_cuts);
    const totalRev = numberValue(row.total_rev);
    return {
      storeDisplayName: String(row.store_display_name || "Unknown"),
      billedBy: String(row.billed_by || "Unknown"),
      revenue,
      revenueGrowth: calculateGrowth(revenue, numberValue(row.prev_revenue)),
      billCuts,
      billCutsGrowth: calculateGrowth(billCuts, numberValue(row.prev_bill_cuts)),
      units: numberValue(row.current_units),
      aov: billCuts > 0 ? revenue / billCuts : 0,
      contributionPercent: totalRev > 0 ? (revenue / totalRev) * 100 : 0,
    };
  });
}
