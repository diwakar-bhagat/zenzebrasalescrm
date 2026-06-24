import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import { type ComparisonPeriods, growthPct } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import { METRICS } from "./metrics";

type FounderSql = NeonQueryFunction<false, false>;
function n(v: unknown) {
	return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0;
}
function retailFilter(f: DashboardFilters) {
	return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getCustomerIntelligence(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
) {
	const food = retailFilter(filters);

	const baseQueryString = `
    SELECT COUNT(DISTINCT customer_mobile) FILTER (WHERE customer_mobile IS NOT NULL AND customer_mobile <> '') AS total_customers
    FROM sales_fact_v WHERE sale_date BETWEEN $1::date AND $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text[] IS NULL OR category <> ALL($6::text[]))`;

	const repeatQueryString = `
    SELECT COUNT(*)::integer AS repeat_customers FROM (
      SELECT customer_mobile FROM sales_fact_v WHERE sale_date BETWEEN $1::date AND $2::date
        AND customer_mobile IS NOT NULL AND customer_mobile <> ''
        AND ($3::text IS NULL OR billed_by = $3)
        AND ($4::text[] IS NULL OR category <> ALL($4::text[]))
      GROUP BY customer_mobile HAVING ${METRICS.bills} > 1) x`;

	const topCustomersQueryString = `
    SELECT customer_mobile, MAX(customer_name) AS customer_name, ${METRICS.bills} AS bill_count, ${METRICS.revenue} AS revenue
    FROM sales_fact_v WHERE sale_date BETWEEN $1::date AND $2::date
      AND customer_mobile IS NOT NULL AND customer_mobile <> ''
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text[] IS NULL OR category <> ALL($4::text[]))
    GROUP BY customer_mobile ORDER BY revenue DESC LIMIT 10`;

	const [current, previous, repeat, topCustomers] = await Promise.all([
		(db as any).query(baseQueryString, [
			periods.currentStart,
			periods.currentEnd,
			filters.store ?? null,
			filters.category ?? null,
			filters.brand ?? null,
			food ?? null,
		]),
		(db as any).query(baseQueryString, [
			periods.previousStart,
			periods.previousEnd,
			filters.store ?? null,
			filters.category ?? null,
			filters.brand ?? null,
			food ?? null,
		]),
		(db as any).query(repeatQueryString, [
			periods.currentStart,
			periods.currentEnd,
			filters.store ?? null,
			food ?? null,
		]),
		(db as any).query(topCustomersQueryString, [
			periods.currentStart,
			periods.currentEnd,
			filters.store ?? null,
			food ?? null,
		]),
	]);

	const totalCustomers = n(current[0]?.total_customers);
	const previousCustomers = n(previous[0]?.total_customers);
	const repeatCustomers = n(repeat[0]?.repeat_customers);

	return {
		totalCustomers,
		previousCustomers,
		customersGrowthPct: growthPct(totalCustomers, previousCustomers),
		repeatCustomers,
		newCustomers: Math.max(totalCustomers - repeatCustomers, 0),
		repeatCustomersNote: "Based on customers who provided a phone number.",
		topCustomers: topCustomers.map((row: any) => ({
			customerMobile: String(row.customer_mobile),
			customerName: row.customer_name ? String(row.customer_name) : null,
			billCount: n(row.bill_count),
			revenue: n(row.revenue),
		})),
	};
}
