import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import type { ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import { toNumber } from "./margin";

type FounderSql = NeonQueryFunction<false, false>;

function retailFilter(filters: DashboardFilters) {
	return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export const PURCHASE_METRICS = {
	netPurchase: "SUM(net_purchase_amount)",
	grossPurchase: "SUM(gross_purchase_amount)",
	tax: "SUM(tax_amount)",
} as const;

export interface PurchaseSummary {
	totalPurchase: number;
	netPurchase: number;
	tax: number;
	grossPurchase: number;
	rows: number;
	hasData: boolean;
}

/** True when any purchase rows exist at all (drives "Purchase data unavailable"). */
export async function hasPurchaseData(db: FounderSql): Promise<boolean> {
	try {
		const [row] = await (db as any).query(
			`SELECT EXISTS(SELECT 1 FROM purchase_fact_v LIMIT 1) AS present`,
		);
		return Boolean(row?.present);
	} catch {
		// purchase_fact_v not migrated yet — degrade gracefully.
		return false;
	}
}

/**
 * Aggregate purchase spend for the current period under the active filters.
 * Mirrors the sales filter contract (store = billed_by, category, brand, sku).
 */
export async function getPurchaseSummary(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
): Promise<PurchaseSummary> {
	const food = retailFilter(filters);

	const empty: PurchaseSummary = {
		totalPurchase: 0,
		netPurchase: 0,
		tax: 0,
		grossPurchase: 0,
		rows: 0,
		hasData: false,
	};

	try {
		const [row] = await (db as any).query(
			`SELECT
        COALESCE(${PURCHASE_METRICS.netPurchase}, 0) AS net_purchase,
        COALESCE(${PURCHASE_METRICS.grossPurchase}, 0) AS gross_purchase,
        COALESCE(${PURCHASE_METRICS.tax}, 0) AS tax,
        COUNT(*)::int AS rows
      FROM purchase_fact_v
      WHERE purchase_date >= $1::date
        AND purchase_date <= $2::date
        AND ($3::text IS NULL OR billed_by = $3)
        AND ($4::text IS NULL OR category = $4)
        AND ($5::text IS NULL OR brand = $5)
        AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
        AND ($7::text[] IS NULL OR category <> ALL($7::text[]))`,
			[
				periods.currentStart,
				periods.currentEnd,
				filters.store ?? null,
				filters.category ?? null,
				filters.brand ?? null,
				filters.sku ?? null,
				food ?? null,
			],
		);

		const netPurchase = toNumber(row?.net_purchase);
		const grossPurchase = toNumber(row?.gross_purchase);
		const tax = toNumber(row?.tax);
		const rows = toNumber(row?.rows);

		return {
			totalPurchase: grossPurchase,
			netPurchase,
			tax,
			grossPurchase,
			rows,
			hasData: rows > 0,
		};
	} catch {
		// Table/view missing — treat as "no purchase data".
		return empty;
	}
}
