import type { NeonQueryFunction } from "@neondatabase/serverless";
import { FOOD_CATEGORIES } from "@/lib/business-logic/filter-sql";
import type { DashboardFilters } from "@/lib/founder/types";

type FounderSql = NeonQueryFunction<false, false>;

function n(v: unknown) {
	return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0;
}

function retailFilter(f: DashboardFilters) {
	return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getCohortMetrics(
	db: FounderSql,
	filters: DashboardFilters,
) {
	const food = retailFilter(filters);
	const store = filters.store ?? null;

	const query = `
    WITH customer_cohort AS (
      SELECT
        customer_mobile,
        DATE_TRUNC('month', MIN(sale_date))::date AS cohort_month
      FROM sales_fact_v
      WHERE customer_mobile IS NOT NULL AND customer_mobile <> ''
        AND ($1::text IS NULL OR billed_by = $1)
        AND ($2::text[] IS NULL OR category <> ALL($2::text[]))
      GROUP BY customer_mobile
    ),
    customer_activity AS (
      SELECT
        sf.customer_mobile,
        DATE_TRUNC('month', sf.sale_date)::date AS activity_month,
        SUM(sf.net_amount) AS revenue,
        COUNT(DISTINCT sf.bill_no) AS bills,
        SUM(sf.quantity) AS units
      FROM sales_fact_v sf
      WHERE sf.customer_mobile IS NOT NULL AND sf.customer_mobile <> ''
        AND ($1::text IS NULL OR sf.billed_by = $1)
        AND ($2::text[] IS NULL OR sf.category <> ALL($2::text[]))
      GROUP BY sf.customer_mobile, activity_month
    ),
    cohort_size AS (
      SELECT
        cohort_month,
        COUNT(DISTINCT customer_mobile) AS cohort_customers
      FROM customer_cohort
      GROUP BY cohort_month
    )
    SELECT
      cc.cohort_month::text AS cohort_month,
      cs.cohort_customers::integer AS cohort_customers,
      ((EXTRACT(YEAR FROM age(ca.activity_month, cc.cohort_month)) * 12) + EXTRACT(MONTH FROM age(ca.activity_month, cc.cohort_month)))::integer AS month_index,
      COUNT(DISTINCT ca.customer_mobile)::integer AS active_customers,
      SUM(ca.revenue)::numeric AS revenue,
      SUM(ca.bills)::integer AS bills,
      SUM(ca.units)::integer AS units
    FROM customer_cohort cc
    JOIN customer_activity ca ON cc.customer_mobile = ca.customer_mobile
    JOIN cohort_size cs ON cc.cohort_month = cs.cohort_month
    WHERE ca.activity_month >= cc.cohort_month
    GROUP BY cc.cohort_month, cs.cohort_customers, month_index
    ORDER BY cc.cohort_month ASC, month_index ASC
  `;

	const rows = await (db as any).query(query, [store, food]);

	const cohortsMap: Record<
		string,
		{
			cohortMonth: string;
			cohortCustomers: number;
			months: Record<
				number,
				{
					activeCustomers: number;
					retentionPct: number;
					revenue: number;
					aov: number;
					billCuts: number;
				}
			>;
		}
	> = {};

	for (const row of rows) {
		const monthKey = row.cohort_month;
		const size = row.cohort_customers;
		const idx = row.month_index;

		if (!cohortsMap[monthKey]) {
			cohortsMap[monthKey] = {
				cohortMonth: monthKey,
				cohortCustomers: size,
				months: {},
			};
		}

		const active = row.active_customers;
		const rev = n(row.revenue);
		const bills = n(row.bills);
		const retentionPct = size > 0 ? (active / size) * 100 : 0;
		const aov = bills > 0 ? rev / bills : 0;
		const billCuts = active > 0 ? bills / active : 0;

		cohortsMap[monthKey].months[idx] = {
			activeCustomers: active,
			retentionPct: Math.round(retentionPct * 10) / 10,
			revenue: Math.round(rev),
			aov: Math.round(aov),
			billCuts: Math.round(billCuts * 10) / 10,
		};
	}

	const monthsList = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const formattedCohorts = Object.entries(cohortsMap)
		.map(([rawDate, data]) => {
			const dateObj = new Date(rawDate);
			const cohortLabel = `${monthsList[dateObj.getUTCMonth()]} ${dateObj.getUTCFullYear()}`;

			const monthValues = Array.from({ length: 6 }, (_, i) => {
				const mData = data.months[i];
				return {
					monthIndex: i,
					activeCustomers: mData ? mData.activeCustomers : 0,
					retentionPct: mData ? mData.retentionPct : 0,
					revenue: mData ? mData.revenue : 0,
					aov: mData ? mData.aov : 0,
					billCuts: mData ? mData.billCuts : 0,
				};
			});

			return {
				cohortMonth: rawDate,
				cohortLabel,
				cohortCustomers: data.cohortCustomers,
				months: monthValues,
			};
		})
		.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

	return formattedCohorts;
}
