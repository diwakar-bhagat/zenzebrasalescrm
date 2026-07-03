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

export async function getLtvDistribution(
	db: FounderSql,
	filters: DashboardFilters,
) {
	const food = retailFilter(filters);
	const store = filters.store ?? null;

	const query = `
    WITH customer_revenue AS (
      SELECT customer_mobile, SUM(net_amount) AS ltv_revenue
      FROM sales_fact_v
      WHERE customer_mobile IS NOT NULL AND customer_mobile <> ''
        AND ($1::text IS NULL OR billed_by = $1)
        AND ($2::text[] IS NULL OR category <> ALL($2::text[]))
      GROUP BY customer_mobile
    )
    SELECT
      CASE
        WHEN ltv_revenue <= 1000 THEN '0-1000'
        WHEN ltv_revenue <= 5000 THEN '1000-5000'
        WHEN ltv_revenue <= 10000 THEN '5000-10000'
        ELSE '10000+'
      END AS range,
      COUNT(*)::integer AS count
    FROM customer_revenue
    GROUP BY range
  `;

	const rows = await (db as any).query(query, [store, food]);

	const ranges = ["0-1000", "1000-5000", "5000-10000", "10000+"];
	const distribution = ranges.map((r) => ({
		range: r,
		count: n(rows.find((row: any) => row.range === r)?.count),
	}));

	return distribution;
}

export async function getTopCustomers(
	db: FounderSql,
	filters: DashboardFilters,
) {
	const food = retailFilter(filters);
	const store = filters.store ?? null;

	const query = `
    SELECT
      customer_mobile AS "customerMobile",
      COALESCE(customer_name, 'Valued Customer') AS "customerName",
      COUNT(DISTINCT bill_no)::integer AS orders,
      SUM(net_amount)::numeric AS revenue,
      (SUM(net_amount) / NULLIF(COUNT(DISTINCT bill_no), 0))::numeric AS aov,
      SUM(net_amount)::numeric AS ltv,
      ROUND(LEAST(100, (COUNT(DISTINCT bill_no) * 10) + (100 / (1 + (CURRENT_DATE - MAX(sale_date))))))::integer AS "retentionScore"
    FROM sales_fact_v
    WHERE customer_mobile IS NOT NULL AND customer_mobile <> ''
      AND ($1::text IS NULL OR billed_by = $1)
      AND ($2::text[] IS NULL OR category <> ALL($2::text[]))
    GROUP BY customer_mobile, customer_name
    ORDER BY ltv DESC
    LIMIT 50
  `;

	const rows = await (db as any).query(query, [store, food]);
	return rows.map((row: any) => ({
		customerMobile: row.customerMobile,
		customerName: row.customerName,
		orders: n(row.orders),
		revenue: Math.round(n(row.revenue)),
		aov: Math.round(n(row.aov)),
		ltv: Math.round(n(row.ltv)),
		retentionScore: n(row.retentionScore),
	}));
}
