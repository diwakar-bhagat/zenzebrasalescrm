import type { NeonQueryFunction } from "@neondatabase/serverless";

import type { DashboardFilters } from "@/lib/founder/types";
import type {
	ConcentrationBand,
	CustomerConcentrationResult,
} from "@/types/customer-intelligence";

import type { ComparisonPeriods } from "./comparison";
import {
	CUSTOMER_IDENTITY_KEY_SQL,
	IS_IDENTIFIED_SQL,
} from "./customer-identity";
import { FOOD_CATEGORIES } from "./filter-sql";
import { sharePct, toNum } from "./safe-math";

type FounderSql = NeonQueryFunction<false, false>;

/** Pareto percentiles to report. */
const PARETO_PCTS = [10, 20, 30] as const;

/** Revenue-at-Risk depends on the top-N highest-value customers. */
const RISK_TOP_N = 20;

function retailFilter(f: DashboardFilters) {
	return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

interface ConcentrationRow {
	total_customers: number;
	total_revenue: number;
	top10_customers: number;
	top10_revenue: number;
	top20_customers: number;
	top20_revenue: number;
	top30_customers: number;
	top30_revenue: number;
	risk_customers: number;
	risk_revenue: number;
	risk_identified: number;
}

/**
 * Customer revenue concentration — Pareto (do the top 10/20/30% of customers
 * drive most revenue?) and Revenue at Risk (dependence on the top-N whales).
 * Lifetime revenue per customer, as-of the selected end date. One window query.
 */
export async function getCustomerConcentration(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
	useMv = false,
): Promise<CustomerConcentrationResult> {
	const food = retailFilter(filters);

	// Ranking + Pareto/risk aggregation is identical regardless of source; only the
	// per-customer revenue CTE differs (live scan vs materialized lifetime layer).
	const perCustomerLive = `
    base AS (
      SELECT
        (${CUSTOMER_IDENTITY_KEY_SQL}) AS ck,
        (${IS_IDENTIFIED_SQL}) AS is_identified,
        net_amount
      FROM sales_fact_v
      WHERE sale_date <= $1::date
        AND ($2::text IS NULL OR billed_by = $2)
        AND ($3::text IS NULL OR category = $3)
        AND ($4::text IS NULL OR brand = $4)
        AND ($5::text[] IS NULL OR category <> ALL($5::text[]))
    ),
    per_customer AS (
      SELECT ck, SUM(net_amount) AS revenue, bool_or(is_identified) AS is_identified
      FROM base
      GROUP BY ck
    )`;
	// MV path uses $1 = store only (gate guarantees no category/brand/sku/retail).
	const perCustomerMv = `
    per_customer AS (
      SELECT identity_key AS ck,
        SUM(lifetime_revenue) AS revenue,
        bool_or(identity_source <> 'anonymous') AS is_identified
      FROM mv_customer_identity
      WHERE ($1::text IS NULL OR billed_by = $1)
      GROUP BY identity_key
    )`;

	const queryString = `
    WITH ${useMv ? perCustomerMv : perCustomerLive},
    ranked AS (
      SELECT
        ck,
        revenue,
        is_identified,
        ROW_NUMBER() OVER (ORDER BY revenue DESC, ck) AS rnk,
        COUNT(*) OVER () AS total_customers,
        SUM(revenue) OVER () AS total_revenue
      FROM per_customer
    )
    SELECT
      MIN(total_customers)::integer AS total_customers,
      COALESCE(MIN(total_revenue), 0) AS total_revenue,
      COUNT(*) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.10)))::integer AS top10_customers,
      COALESCE(SUM(revenue) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.10))), 0) AS top10_revenue,
      COUNT(*) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.20)))::integer AS top20_customers,
      COALESCE(SUM(revenue) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.20))), 0) AS top20_revenue,
      COUNT(*) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.30)))::integer AS top30_customers,
      COALESCE(SUM(revenue) FILTER (WHERE rnk <= GREATEST(1, ceil(total_customers * 0.30))), 0) AS top30_revenue,
      COUNT(*) FILTER (WHERE rnk <= LEAST(${RISK_TOP_N}, total_customers))::integer AS risk_customers,
      COALESCE(SUM(revenue) FILTER (WHERE rnk <= LEAST(${RISK_TOP_N}, total_customers)), 0) AS risk_revenue,
      COUNT(*) FILTER (WHERE rnk <= LEAST(${RISK_TOP_N}, total_customers) AND is_identified)::integer AS risk_identified
    FROM ranked`;

	const [row]: ConcentrationRow[] = await (db as any).query(
		queryString,
		useMv
			? [filters.store ?? null]
			: [
					periods.currentEnd,
					filters.store ?? null,
					filters.category ?? null,
					filters.brand ?? null,
					food ?? null,
				],
	);

	const totalCustomers = toNum(row?.total_customers);
	const totalRevenue = toNum(row?.total_revenue);

	const byPct: Record<number, { customers: number; revenue: number }> = {
		10: {
			customers: toNum(row?.top10_customers),
			revenue: toNum(row?.top10_revenue),
		},
		20: {
			customers: toNum(row?.top20_customers),
			revenue: toNum(row?.top20_revenue),
		},
		30: {
			customers: toNum(row?.top30_customers),
			revenue: toNum(row?.top30_revenue),
		},
	};

	const pareto: ConcentrationBand[] = PARETO_PCTS.map((topPct) => {
		const band = byPct[topPct];
		return {
			label: `Top ${topPct}%`,
			topPct,
			customers: band.customers,
			revenue: band.revenue,
			revenueSharePct: sharePct(band.revenue, totalRevenue),
		};
	});

	const riskRevenue = toNum(row?.risk_revenue);
	const riskCustomers = toNum(row?.risk_customers);

	return {
		pareto,
		revenueAtRisk: {
			topCustomerCount: riskCustomers,
			revenue: riskRevenue,
			revenueSharePct: sharePct(riskRevenue, totalRevenue),
			identifiedCount: toNum(row?.risk_identified),
		},
		totalCustomers,
		totalRevenue,
	};
}
