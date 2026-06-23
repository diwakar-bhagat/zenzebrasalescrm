import type { DashboardFilters } from "@/lib/founder/types";

import { calculateGrowth, growthPct, type ComparisonPeriods } from "./comparison";
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

export async function getDailyHealthMetrics(
  db: FounderSql,
  periods: ComparisonPeriods,
  filters: DashboardFilters,
) {
  const foodCategories = retailFilter(filters);

  const [current, previous, repeatCustomers] = await Promise.all([
    db`
      SELECT
        COALESCE(SUM(net_amount), 0) AS revenue,
        COUNT(DISTINCT bill_no) AS bill_cuts,
        COALESCE(SUM(quantity), 0) AS units,
        COALESCE(SUM(discount_amount), 0) AS discount,
        COUNT(DISTINCT customer_mobile) FILTER (WHERE customer_mobile IS NOT NULL AND customer_mobile <> '') AS customers
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date
        AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
    `,
    db`
      SELECT
        COALESCE(SUM(net_amount), 0) AS revenue,
        COUNT(DISTINCT bill_no) AS bill_cuts,
        COALESCE(SUM(quantity), 0) AS units,
        COALESCE(SUM(discount_amount), 0) AS discount,
        COUNT(DISTINCT customer_mobile) FILTER (WHERE customer_mobile IS NOT NULL AND customer_mobile <> '') AS customers
      FROM sales_fact_v
      WHERE sale_date >= ${periods.previousStart}::date
        AND sale_date <= ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
    `,
    db`
      SELECT COUNT(*)::integer AS repeat_customers
      FROM (
        SELECT customer_mobile
        FROM sales_fact_v
        WHERE sale_date >= ${periods.currentStart}::date
          AND sale_date <= ${periods.currentEnd}::date
          AND customer_mobile IS NOT NULL
          AND customer_mobile <> ''
          AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
          AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
          AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
          AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
          AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
        GROUP BY customer_mobile
        HAVING COUNT(DISTINCT bill_no) > 1
      ) repeat_mobiles
    `,
  ]);

  const currentRow = current[0] ?? {};
  const previousRow = previous[0] ?? {};

  const currentRevenue = numberValue(currentRow.revenue);
  const previousRevenue = numberValue(previousRow.revenue);
  const currentBillCuts = numberValue(currentRow.bill_cuts);
  const previousBillCuts = numberValue(previousRow.bill_cuts);
  const currentUnits = numberValue(currentRow.units);
  const previousUnits = numberValue(previousRow.units);
  const currentDiscount = numberValue(currentRow.discount);
  const previousDiscount = numberValue(previousRow.discount);
  const currentCustomers = numberValue(currentRow.customers);
  const previousCustomers = numberValue(previousRow.customers);
  const currentAov = currentBillCuts > 0 ? currentRevenue / currentBillCuts : 0;
  const previousAov = previousBillCuts > 0 ? previousRevenue / previousBillCuts : 0;
  const repeatCustomersCount = numberValue(repeatCustomers[0]?.repeat_customers);

  const metrics = [
    {
      metric: "Sales",
      current: currentRevenue,
      previous: previousRevenue,
      growth: growthPct(currentRevenue, previousRevenue),
    },
    {
      metric: "Orders",
      current: currentBillCuts,
      previous: previousBillCuts,
      growth: growthPct(currentBillCuts, previousBillCuts),
    },
    {
      metric: "AOV",
      current: currentAov,
      previous: previousAov,
      growth: growthPct(currentAov, previousAov),
    },
    {
      metric: "Units",
      current: currentUnits,
      previous: previousUnits,
      growth: growthPct(currentUnits, previousUnits),
    },
    {
      metric: "Customers",
      current: currentCustomers,
      previous: previousCustomers,
      growth: growthPct(currentCustomers, previousCustomers),
    },
    {
      metric: "Repeat Customers",
      current: repeatCustomersCount,
      previous: null,
      growth: null,
      footnote: "Based on customers who provided a phone number.",
    },
  ];

  return {
    metrics,
    salesKpis: {
      revenue: { current: currentRevenue, previous: previousRevenue, growth: calculateGrowth(currentRevenue, previousRevenue) },
      billCuts: { current: currentBillCuts, previous: previousBillCuts, growth: calculateGrowth(currentBillCuts, previousBillCuts) },
      unitsSold: { current: currentUnits, previous: previousUnits, growth: calculateGrowth(currentUnits, previousUnits) },
      discount: { current: currentDiscount, previous: previousDiscount, growth: calculateGrowth(currentDiscount, previousDiscount) },
    },
    aovKpi: {
      current: currentAov,
      previous: previousAov,
      growth: calculateGrowth(currentAov, previousAov),
    },
  };
}

export async function getBrandPerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const foodCategories = retailFilter(filters);

  const result = await db`
    WITH curr AS (
      SELECT brand, SUM(quantity) AS units, SUM(net_amount) AS revenue
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date
        AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND brand IS NOT NULL
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY brand
    ),
    prev AS (
      SELECT brand, SUM(quantity) AS units, SUM(net_amount) AS revenue
      FROM sales_fact_v
      WHERE sale_date >= ${periods.previousStart}::date
        AND sale_date <= ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND brand IS NOT NULL
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY brand
    )
    SELECT
      COALESCE(c.brand, p.brand) AS brand,
      COALESCE(c.units, 0) AS current_units,
      COALESCE(c.revenue, 0) AS current_revenue,
      COALESCE(p.units, 0) AS prev_units,
      COALESCE(p.revenue, 0) AS prev_revenue
    FROM curr c
    FULL OUTER JOIN prev p USING (brand)
    ORDER BY ABS(COALESCE(c.units, 0) - COALESCE(p.units, 0)) DESC NULLS LAST
  `;

  return result.map((row) => {
    const currentUnits = numberValue(row.current_units);
    const prevUnits = numberValue(row.prev_units);
    return {
      brand: String(row.brand || "Unknown"),
      currentUnits,
      currentRevenue: numberValue(row.current_revenue),
      prevUnits,
      prevRevenue: numberValue(row.prev_revenue),
      unitsGrowthPct: growthPct(currentUnits, prevUnits),
    };
  });
}

export async function getSkuPerformance(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const foodCategories = retailFilter(filters);

  const result = await db`
    WITH curr AS (
      SELECT 
        sku_code, 
        MAX(item_name) AS item_name, 
        MAX(brand) AS brand, 
        MAX(category) AS category, 
        SUM(quantity) AS units, 
        SUM(net_amount) AS revenue
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date
        AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY sku_code
    ),
    prev AS (
      SELECT 
        sku_code, 
        MAX(item_name) AS item_name, 
        MAX(brand) AS brand, 
        MAX(category) AS category, 
        SUM(quantity) AS units, 
        SUM(net_amount) AS revenue
      FROM sales_fact_v
      WHERE sale_date >= ${periods.previousStart}::date
        AND sale_date <= ${periods.previousEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}::text[]))
      GROUP BY sku_code
    )
    SELECT
      COALESCE(c.sku_code, p.sku_code) AS sku_code,
      COALESCE(c.item_name, p.item_name, c.sku_code, p.sku_code, 'Unknown SKU') AS item_name,
      COALESCE(c.brand, p.brand) AS brand,
      COALESCE(c.category, p.category) AS category,
      COALESCE(c.units, 0) AS current_units,
      COALESCE(c.revenue, 0) AS current_revenue,
      COALESCE(p.units, 0) AS prev_units,
      ABS(COALESCE(c.units, 0) - COALESCE(p.units, 0)) AS abs_unit_change
    FROM curr c
    FULL OUTER JOIN prev p USING (sku_code)
    ORDER BY abs_unit_change DESC NULLS LAST
    LIMIT 20
  `;

  return result.map((row) => {
    const currentUnits = numberValue(row.current_units);
    const prevUnits = numberValue(row.prev_units);
    return {
      skuCode: row.sku_code ? String(row.sku_code) : null,
      itemName: String(row.item_name),
      brand: row.brand ? String(row.brand) : null,
      category: row.category ? String(row.category) : null,
      currentUnits,
      currentRevenue: numberValue(row.current_revenue),
      prevUnits,
      unitsGrowthPct: growthPct(currentUnits, prevUnits),
    };
  });
}

/** @deprecated Use getDailyHealthMetrics */
export const getSalesKpis = getDailyHealthMetrics;
/** @deprecated Use getSkuPerformance */
export const getProductPerformance = getSkuPerformance;
