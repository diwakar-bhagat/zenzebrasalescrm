import type { DashboardFilters } from "@/lib/founder/types";
import type { ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;
function n(v: unknown) { return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0; }
function retailFilter(f: DashboardFilters) { return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null; }

export async function getPaymentAnalysis(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const food = retailFilter(filters);
  const [overall, byStore] = await Promise.all([
    db`SELECT COALESCE(payment_method,'Unknown') AS payment_method, SUM(net_amount) AS revenue, COUNT(DISTINCT bill_no) AS bill_cuts
      FROM sales_fact_v WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      GROUP BY payment_method ORDER BY revenue DESC`,
    db`SELECT store_display_name, COALESCE(payment_method,'Unknown') AS payment_method, SUM(net_amount) AS revenue, COUNT(DISTINCT bill_no) AS bill_cuts
      FROM sales_fact_v WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      GROUP BY store_display_name, payment_method ORDER BY store_display_name, revenue DESC`,
  ]);
  const totalRevenue = overall.reduce((s, row) => s + n(row.revenue), 0);
  return { methods: overall.map((row) => ({ paymentMethod: String(row.payment_method), revenue: n(row.revenue),
      billCuts: n(row.bill_cuts), revenueSharePct: totalRevenue > 0 ? Math.round((n(row.revenue) / totalRevenue) * 1000) / 10 : 0 })),
    byStore: byStore.map((row) => ({ storeDisplayName: String(row.store_display_name), paymentMethod: String(row.payment_method),
      revenue: n(row.revenue), billCuts: n(row.bill_cuts) })) };
}
