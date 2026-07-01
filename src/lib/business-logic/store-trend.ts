import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import { FOOD_CATEGORIES } from "./filter-sql";

type FounderSql = NeonQueryFunction<false, false>;

export interface StoreTrendRow {
	date: string;
	stores: Array<{
		name: string;
		revenue: number;
		purchase: number;
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

	const salesQuery = `
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
  `;

	const purchaseQuery = `
    SELECT purchase_date::text AS date,
      store_display_name,
      COALESCE(SUM(net_purchase_amount), 0)::numeric AS purchase
    FROM purchase_fact_v
    WHERE purchase_date >= $1::date AND purchase_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
    GROUP BY purchase_date, store_display_name
  `;

	interface DbQueryClient {
		query: (
			sql: string,
			params?: unknown[],
		) => Promise<Record<string, unknown>[]>;
	}
	const dbClient = db as unknown as DbQueryClient;

	const [salesRows, purchaseRows] = await Promise.all([
		dbClient.query(salesQuery, [
			filters.startDate,
			filters.endDate,
			filters.store ?? null,
			filters.category ?? null,
			filters.brand ?? null,
			filters.sku ?? null,
			foodCategories ?? null,
		]),
		dbClient
			.query(purchaseQuery, [
				filters.startDate,
				filters.endDate,
				filters.store ?? null,
				filters.category ?? null,
				filters.brand ?? null,
				filters.sku ?? null,
				foodCategories ?? null,
			])
			.catch(() => []),
	]);

	const storeDataMap = new Map<
		string,
		Map<string, { revenue: number; purchase: number }>
	>();

	for (const row of salesRows) {
		const dateStr = String(row.date);
		const storeName = String(row.store_display_name || "Unknown");
		const revenue = Number(row.revenue ?? 0);

		let storeMap = storeDataMap.get(dateStr);
		if (!storeMap) {
			storeMap = new Map();
			storeDataMap.set(dateStr, storeMap);
		}
		storeMap.set(storeName, { revenue, purchase: 0 });
	}

	for (const row of purchaseRows) {
		const dateStr = String(row.date);
		const storeName = String(row.store_display_name || "Unknown");
		const purchase = Number(row.purchase ?? 0);

		let storeMap = storeDataMap.get(dateStr);
		if (!storeMap) {
			storeMap = new Map();
			storeDataMap.set(dateStr, storeMap);
		}
		const existing = storeMap.get(storeName) || { revenue: 0, purchase: 0 };
		storeMap.set(storeName, { ...existing, purchase });
	}

	const result: StoreTrendRow[] = [];
	for (const [date, storeMap] of storeDataMap.entries()) {
		const storesList = Array.from(storeMap.entries()).map(([name, data]) => ({
			name,
			revenue: Math.round(data.revenue * 100) / 100,
			purchase: Math.round(data.purchase * 100) / 100,
		}));
		result.push({
			date,
			stores: storesList,
		});
	}

	return result.sort((a, b) => a.date.localeCompare(b.date));
}
