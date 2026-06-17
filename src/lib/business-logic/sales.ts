import type { DashboardFilters } from "@/lib/founder/types";

import { calculateGrowth, type ComparisonPeriods } from "./comparison";

import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getSalesKpis(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const result = await db`
    SELECT
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN net_amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN net_amount ELSE 0 END), 0) AS previous_revenue,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN bill_no END) AS current_bills,
      COUNT(DISTINCT CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN bill_no END) AS previous_bills,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN quantity ELSE 0 END), 0) AS current_qty,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN quantity ELSE 0 END), 0) AS previous_qty
    FROM sales_fact
    WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
  `;

  const row = result[0] ?? {};
  const currentRevenue = numberValue(row.current_revenue);
  const previousRevenue = numberValue(row.previous_revenue);
  const currentBills = numberValue(row.current_bills);
  const previousBills = numberValue(row.previous_bills);
  const currentQty = numberValue(row.current_qty);
  const previousQty = numberValue(row.previous_qty);

  return {
    revenue: {
      current: currentRevenue,
      previous: previousRevenue,
      growth: calculateGrowth(currentRevenue, previousRevenue),
    },
    billCuts: {
      current: currentBills,
      previous: previousBills,
      growth: calculateGrowth(currentBills, previousBills),
    },
    unitsSold: {
      current: currentQty,
      previous: previousQty,
      growth: calculateGrowth(currentQty, previousQty),
    },
  };
}

export async function getCategoryPerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const result = await db`
    SELECT
      category,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN net_amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN net_amount ELSE 0 END), 0) AS previous_revenue
    FROM sales_fact
    WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
    GROUP BY category
    ORDER BY current_revenue DESC
    LIMIT 10
  `;

  return result.map((row) => {
    const revenue = numberValue(row.current_revenue);
    const previousRevenue = numberValue(row.previous_revenue);
    return {
      category: String(row.category || "Unknown"),
      revenue,
      previousRevenue,
      growth: calculateGrowth(revenue, previousRevenue),
    };
  });
}

export async function getProductPerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const result = await db`
    SELECT
      sku,
      product_name,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN quantity ELSE 0 END), 0) AS current_quantity,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date THEN net_amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date THEN net_amount ELSE 0 END), 0) AS previous_revenue
    FROM sales_fact
    WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
    GROUP BY sku, product_name
    ORDER BY current_quantity DESC
    LIMIT 10
  `;

  return result.map((row) => {
    const revenue = numberValue(row.current_revenue);
    const previousRevenue = numberValue(row.previous_revenue);
    return {
      sku: String(row.sku || ""),
      item: String(row.product_name || "Unknown"),
      quantity: numberValue(row.current_quantity),
      revenue,
      previousRevenue,
      growth: calculateGrowth(revenue, previousRevenue),
    };
  });
}
