import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import { type ComparisonPeriods, calculateGrowth } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import { METRICS } from "./metrics";

type FounderSql = NeonQueryFunction<false, false>;

function numberValue(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function retailFilter(filters: DashboardFilters) {
	return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getStorePerformance(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
) {
	const foodCategories = retailFilter(filters);

	const queryString = `
    WITH curr AS (
      SELECT store_display_name, billed_by, ${METRICS.revenue} AS revenue,
        ${METRICS.bills} AS bill_cuts, SUM(quantity) AS units
      FROM sales_fact_v
      WHERE sale_date >= $1::date AND sale_date <= $2::date
        AND ($3::text IS NULL OR billed_by = $3)
        AND ($4::text IS NULL OR category = $4)
        AND ($5::text IS NULL OR brand = $5)
        AND ($6::text IS NULL OR sku_code = $6)
        AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
      GROUP BY store_display_name, billed_by
    ),
    prev AS (
      SELECT billed_by, ${METRICS.revenue} AS revenue, ${METRICS.bills} AS bill_cuts
      FROM sales_fact_v
      WHERE sale_date >= $8::date AND sale_date <= $9::date
        AND ($3::text IS NULL OR billed_by = $3)
        AND ($4::text IS NULL OR category = $4)
        AND ($5::text IS NULL OR brand = $5)
        AND ($6::text IS NULL OR sku_code = $6)
        AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
      GROUP BY billed_by
    ),
    total_curr AS (SELECT SUM(revenue) AS total_rev FROM curr)
    SELECT c.store_display_name, c.billed_by, c.revenue AS current_revenue, c.bill_cuts AS current_bill_cuts,
      c.units AS current_units, p.revenue AS prev_revenue, p.bill_cuts AS prev_bill_cuts, t.total_rev
    FROM curr c LEFT JOIN prev p USING (billed_by) CROSS JOIN total_curr t ORDER BY c.revenue DESC`;

	const result = await (db as any).query(queryString, [
		periods.currentStart,
		periods.currentEnd,
		filters.store ?? null,
		filters.category ?? null,
		filters.brand ?? null,
		filters.sku ?? null,
		foodCategories ?? null,
		periods.previousStart,
		periods.previousEnd,
	]);

	return result.map((row: any) => {
		const revenue = numberValue(row.current_revenue);
		const billCuts = numberValue(row.current_bill_cuts);
		const totalRev = numberValue(row.total_rev);
		return {
			storeDisplayName: String(row.store_display_name || "Unknown"),
			billedBy: String(row.billed_by || "Unknown"),
			revenue,
			revenueGrowth: calculateGrowth(revenue, numberValue(row.prev_revenue)),
			billCuts,
			billCutsGrowth: calculateGrowth(
				billCuts,
				numberValue(row.prev_bill_cuts),
			),
			units: numberValue(row.current_units),
			aov: billCuts > 0 ? revenue / billCuts : 0,
			contributionPercent: totalRev > 0 ? (revenue / totalRev) * 100 : 0,
		};
	});
}
