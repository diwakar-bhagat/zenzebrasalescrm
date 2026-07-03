import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import { FOOD_CATEGORIES } from "./filter-sql";

type FounderSql = NeonQueryFunction<false, false>;

export interface StoreTrendRow {
	date: string;
	stores: Array<{
		name: string;
		revenue: number;
	}>;
}

function retailFilter(filters: DashboardFilters) {
	return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getStoreTrend(
	db: FounderSql,
	filters: DashboardFilters,
): Promise<StoreTrendRow[]> {
	const foodCategories = retailFilter(filters);

	const queryString = `
    SELECT sale_date::text AS date,
      store_display_name,
      COALESCE(SUM(net_amount), 0)::numeric AS revenue
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
    GROUP BY sale_date, store_display_name
    ORDER BY sale_date ASC, store_display_name ASC
  `;

	const rows = await (db as any).query(queryString, [
		filters.startDate,
		filters.endDate,
		filters.store ?? null,
		filters.category ?? null,
		filters.brand ?? null,
		filters.sku ?? null,
		foodCategories ?? null,
	]);

	// Group rows by date
	const trendsByDate = new Map<
		string,
		Array<{ name: string; revenue: number }>
	>();

	for (const row of rows) {
		const dateStr = String(row.date);
		const storeName = String(row.store_display_name || "Unknown");
		const revenue = Number(row.revenue ?? 0);

		if (!trendsByDate.has(dateStr)) {
			trendsByDate.set(dateStr, []);
		}
		trendsByDate.get(dateStr)?.push({
			name: storeName,
			revenue: Math.round(revenue * 100) / 100,
		});
	}

	const result: StoreTrendRow[] = [];
	for (const [date, stores] of trendsByDate.entries()) {
		result.push({
			date,
			stores,
		});
	}

	// Recharts works best when dates are sorted chronologically
	return result.sort((a, b) => a.date.localeCompare(b.date));
}
