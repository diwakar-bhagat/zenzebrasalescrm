import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
	type ComparisonPeriods,
	growthPct,
} from "@/lib/business-logic/comparison";
import { FOOD_CATEGORIES } from "@/lib/business-logic/filter-sql";
import type { DashboardFilters } from "@/lib/founder/types";

type FounderSql = NeonQueryFunction<false, false>;

function n(v: unknown) {
	return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0;
}

function retailFilter(f: DashboardFilters) {
	return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getCacMetrics(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
) {
	const food = retailFilter(filters);
	const store = filters.store ?? null;

	const start = new Date(periods.currentStart);
	const end = new Date(periods.currentEnd);
	const days = Math.max(
		1,
		Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
	);

	let monthlySpend = 200000;
	if (store === "SmartworksNoida Noida") monthlySpend = 150000;
	else if (store === "Klj store") monthlySpend = 50000;

	const currentSpend = Math.round((monthlySpend / 30) * days);

	const prevStart = new Date(periods.previousStart);
	const prevEnd = new Date(periods.previousEnd);
	const prevDays = Math.max(
		1,
		Math.ceil(
			(prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24),
		) + 1,
	);
	const prevSpend = Math.round((monthlySpend / 30) * prevDays);

	const newCustomersQuery = `
    SELECT 
      COUNT(DISTINCT sf.customer_mobile)::integer AS count,
      COALESCE(SUM(sf.net_amount), 0)::numeric AS revenue,
      COUNT(DISTINCT sf.bill_no)::integer AS orders
    FROM sales_fact_v sf
    JOIN customer_metrics cm ON sf.customer_mobile = cm.customer_mobile
    WHERE cm.first_purchase_date BETWEEN $1::date AND $2::date
      AND ($3::text IS NULL OR sf.billed_by = $3)
      AND ($4::text[] IS NULL OR sf.category <> ALL($4::text[]))
  `;

	const [currNewRes, prevNewRes] = await Promise.all([
		(db as any).query(newCustomersQuery, [
			periods.currentStart,
			periods.currentEnd,
			store,
			food,
		]),
		(db as any).query(newCustomersQuery, [
			periods.previousStart,
			periods.previousEnd,
			store,
			food,
		]),
	]);

	const currNew = Math.max(1, n(currNewRes[0]?.count));
	const prevNew = Math.max(1, n(prevNewRes[0]?.count));

	const currRevenue = n(currNewRes[0]?.revenue);
	const prevRevenue = n(prevNewRes[0]?.revenue);
	const currOrders = n(currNewRes[0]?.orders);

	const currLtv = currNew > 0 ? currRevenue / currNew : 0;
	const prevLtv = prevNew > 0 ? prevRevenue / prevNew : 0;

	const currCac = currentSpend / currNew;
	const prevCac = prevSpend / prevNew;

	const ltvCacRatio = currCac > 0 ? currLtv / currCac : 0;
	const prevLtvCacRatio = prevCac > 0 ? prevLtv / prevCac : 0;

	const aov = currOrders > 0 ? currRevenue / currOrders : 150;
	const monthlyGrossProfitPerCustomer = aov * 0.26 * 1.5;
	const paybackMonths = currCac / Math.max(1, monthlyGrossProfitPerCustomer);

	return {
		totalSpend: {
			current: currentSpend,
			previous: prevSpend,
			growth: growthPct(currentSpend, prevSpend),
		},
		newCustomers: {
			current: currNew,
			previous: prevNew,
			growth: growthPct(currNew, prevNew),
		},
		cac: {
			current: Math.round(currCac),
			previous: Math.round(prevCac),
			growth: growthPct(currCac, prevCac),
		},
		ltvCacRatio: {
			current: Math.round(ltvCacRatio * 10) / 10,
			previous: Math.round(prevLtvCacRatio * 10) / 10,
			growth: growthPct(ltvCacRatio, prevLtvCacRatio),
		},
		paybackPeriod: {
			current: Math.round(paybackMonths * 10) / 10,
		},
	};
}
