import type { DashboardFilters } from "@/lib/founder/types";
import { growthPct, type ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;
function n(v: unknown) { return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0; }
function retailFilter(f: DashboardFilters) { return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null; }

export async function getCategoryBillCuts(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const food = retailFilter(filters);
  const result = await db`
    WITH curr AS (SELECT category, COUNT(DISTINCT bill_no) AS bill_cuts, SUM(quantity) AS units FROM sales_fact_v
      WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null}) AND category IS NOT NULL
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[])) GROUP BY category),
    prev AS (SELECT category, COUNT(DISTINCT bill_no) AS bill_cuts, SUM(quantity) AS units FROM sales_fact_v
      WHERE sale_date BETWEEN ${periods.previousStart}::date AND ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null}) AND category IS NOT NULL
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[])) GROUP BY category),
    all_categories AS (SELECT DISTINCT category FROM sales_fact_v WHERE category IS NOT NULL
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[])))
    SELECT ac.category, COALESCE(c.bill_cuts,0) AS current_bill_cuts, COALESCE(c.units,0) AS current_units,
      COALESCE(p.bill_cuts,0) AS prev_bill_cuts, COALESCE(p.units,0) AS prev_units
    FROM all_categories ac LEFT JOIN curr c USING (category) LEFT JOIN prev p USING (category)
    ORDER BY current_bill_cuts DESC`;
  return result.map((row) => ({
    category: String(row.category), currentBillCuts: n(row.current_bill_cuts), currentUnits: n(row.current_units),
    prevBillCuts: n(row.prev_bill_cuts), prevUnits: n(row.prev_units),
    billCutsGrowthPct: growthPct(n(row.current_bill_cuts), n(row.prev_bill_cuts)),
    unitsGrowthPct: growthPct(n(row.current_units), n(row.prev_units)),
  }));
}

export async function getCategoryAov(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const food = retailFilter(filters);
  const result = await db`
    WITH curr AS (SELECT category, SUM(net_amount) AS revenue, COUNT(DISTINCT bill_no) AS bill_cuts,
      ROUND(SUM(net_amount)/NULLIF(COUNT(DISTINCT bill_no),0),2) AS aov FROM sales_fact_v
      WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null}) AND category IS NOT NULL
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[])) GROUP BY category),
    prev AS (SELECT category, ROUND(SUM(net_amount)/NULLIF(COUNT(DISTINCT bill_no),0),2) AS aov FROM sales_fact_v
      WHERE sale_date BETWEEN ${periods.previousStart}::date AND ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null}) AND category IS NOT NULL
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[])) GROUP BY category)
    SELECT COALESCE(c.category,p.category) AS category, COALESCE(c.aov,0) AS current_aov,
      COALESCE(c.revenue,0) AS current_revenue, COALESCE(c.bill_cuts,0) AS current_bill_cuts, COALESCE(p.aov,0) AS prev_aov
    FROM curr c FULL OUTER JOIN prev p USING (category) ORDER BY current_aov DESC`;
  return result.map((row) => ({
    category: String(row.category || "Unknown"), currentAov: n(row.current_aov), currentRevenue: n(row.current_revenue),
    currentBillCuts: n(row.current_bill_cuts), prevAov: n(row.prev_aov), aovGrowthPct: growthPct(n(row.current_aov), n(row.prev_aov)),
  }));
}

export const getAovKpi = getCategoryAov;
