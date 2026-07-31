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
	topN = 10,
) {
	const food = retailFilter(filters);

	// Optimized single-pass aggregation query: computes total & repeat customers in ONE scan
	const aggregatedCustomerQuery = `
		WITH cust_summary AS (
			SELECT 
				customer_mobile,
				MAX(customer_name) AS customer_name,
				${METRICS.bills} AS bill_count,
				${METRICS.revenue} AS revenue
			FROM sales_fact_v 
			WHERE sale_date BETWEEN $1::date AND $2::date
				AND customer_mobile IS NOT NULL 
				AND customer_mobile <> ''
				AND ($3::text IS NULL OR billed_by = $3)
				AND ($4::text IS NULL OR category = $4)
				AND ($5::text IS NULL OR brand = $5)
				AND ($6::text[] IS NULL OR category <> ALL($6::text[]))
			GROUP BY customer_mobile
		)
		SELECT 
			COUNT(*)::integer AS total_customers,
			COUNT(*) FILTER (WHERE bill_count > 1)::integer AS repeat_customers
		FROM cust_summary
	`;

	const topCustomersQuery = `
		SELECT 
			customer_mobile, 
			MAX(customer_name) AS customer_name, 
			${METRICS.bills} AS bill_count, 
			${METRICS.revenue} AS revenue
		FROM sales_fact_v 
		WHERE sale_date BETWEEN $1::date AND $2::date
			AND customer_mobile IS NOT NULL 
			AND customer_mobile <> ''
			AND ($3::text IS NULL OR billed_by = $3)
			AND ($4::text[] IS NULL OR category <> ALL($4::text[]))
		GROUP BY customer_mobile 
		ORDER BY revenue DESC 
		LIMIT $5::int
	`;

	const [current, previous, topCustomers] = await Promise.all([
		(db as any).query(aggregatedCustomerQuery, [
			periods.currentStart,
			periods.currentEnd,
			filters.store ?? null,
			filters.category ?? null,
			filters.brand ?? null,
			food ?? null,
		]),
		(db as any).query(aggregatedCustomerQuery, [
			periods.previousStart,
			periods.previousEnd,
			filters.store ?? null,
			filters.category ?? null,
			filters.brand ?? null,
			food ?? null,
		]),
		(db as any).query(topCustomersQuery, [
			periods.currentStart,
			periods.currentEnd,
			filters.store ?? null,
			food ?? null,
			topN,
		]),
	]);

	const totalCustomers = n(current[0]?.total_customers);
	const previousCustomers = n(previous[0]?.total_customers);
	const repeatCustomers = n(current[0]?.repeat_customers);

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
