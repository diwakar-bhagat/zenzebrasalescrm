import type { DashboardFilters } from "@/lib/founder/types";
import { growthPct, type ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;
function n(v: unknown) { return Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0; }
function retailFilter(f: DashboardFilters) { return f.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null; }

export async function getCustomerIntelligence(db: FounderSql, periods: ComparisonPeriods, filters: DashboardFilters) {
  const food = retailFilter(filters);
  const base = (start: string, end: string) => db`
    SELECT COUNT(DISTINCT customer_mobile) FILTER (WHERE customer_mobile IS NOT NULL AND customer_mobile <> '') AS total_customers
    FROM sales_fact_v WHERE sale_date BETWEEN ${start}::date AND ${end}::date
      AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))`;
  const [current, previous, repeat, topCustomers] = await Promise.all([
    base(periods.currentStart, periods.currentEnd),
    base(periods.previousStart, periods.previousEnd),
    db`SELECT COUNT(*)::integer AS repeat_customers FROM (
      SELECT customer_mobile FROM sales_fact_v WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND customer_mobile IS NOT NULL AND customer_mobile <> ''
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      GROUP BY customer_mobile HAVING COUNT(DISTINCT bill_no) > 1) x`,
    db`SELECT customer_mobile, MAX(customer_name) AS customer_name, COUNT(DISTINCT bill_no) AS bill_count, SUM(net_amount) AS revenue
      FROM sales_fact_v WHERE sale_date BETWEEN ${periods.currentStart}::date AND ${periods.currentEnd}::date
        AND customer_mobile IS NOT NULL AND customer_mobile <> ''
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      GROUP BY customer_mobile ORDER BY revenue DESC LIMIT 10`,
  ]);
  const totalCustomers = n(current[0]?.total_customers);
  const previousCustomers = n(previous[0]?.total_customers);
  const repeatCustomers = n(repeat[0]?.repeat_customers);
  return { totalCustomers, previousCustomers, customersGrowthPct: growthPct(totalCustomers, previousCustomers),
    repeatCustomers, newCustomers: Math.max(totalCustomers - repeatCustomers, 0),
    repeatCustomersNote: "Based on customers who provided a phone number.",
    topCustomers: topCustomers.map((row) => ({ customerMobile: String(row.customer_mobile),
      customerName: row.customer_name ? String(row.customer_name) : null, billCount: n(row.bill_count), revenue: n(row.revenue) })) };
}
