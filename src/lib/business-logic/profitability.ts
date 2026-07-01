import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import type { ComparisonPeriods } from "./comparison";
import { FOOD_CATEGORIES } from "./filter-sql";
import {
	buildProfitability,
	type ProfitabilityBlock,
	profitPerBill,
	toNumber,
} from "./margin";
import { METRICS } from "./metrics";
import { getPurchaseSummary, hasPurchaseData } from "./purchase";

type FounderSql = NeonQueryFunction<false, false>;

function retailFilter(filters: DashboardFilters) {
	return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

/** Shared filter params in the standard sales-filter order used across the app. */
function salesParams(periods: ComparisonPeriods, filters: DashboardFilters) {
	return [
		periods.currentStart,
		periods.currentEnd,
		filters.store ?? null,
		filters.category ?? null,
		filters.brand ?? null,
		filters.sku ?? null,
		retailFilter(filters) ?? null,
	];
}

/** Top-line profitability for the current period under active filters. */
export async function getProfitability(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
): Promise<
	ProfitabilityBlock & { billCuts: number; profitPerBill: number | null }
> {
	const food = retailFilter(filters);

	const [salesRow] = await (db as any).query(
		`SELECT
      COALESCE(${METRICS.revenue}, 0) AS net_sales,
      ${METRICS.bills} AS bill_cuts
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
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

	const purchase = await getPurchaseSummary(db, periods, filters);
	const netSales = toNumber(salesRow?.net_sales);
	const billCuts = toNumber(salesRow?.bill_cuts);
	const block = buildProfitability(
		netSales,
		purchase.netPurchase,
		purchase.hasData,
	);

	return {
		...block,
		billCuts,
		profitPerBill: block.hasPurchase
			? profitPerBill(block.grossProfit, billCuts)
			: null,
	};
}

export interface StoreProfitabilityRow {
	billedBy: string;
	storeDisplayName: string;
	netSales: number;
	netPurchase: number;
	grossProfit: number;
	marginPercent: number | null;
	units: number;
	billCuts: number;
	hasPurchase: boolean;
}

export async function getStoreProfitability(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
): Promise<StoreProfitabilityRow[]> {
	const food = retailFilter(filters);
	const hasPurchase = await hasPurchaseData(db);

	const salesRows = await (db as any).query(
		`SELECT billed_by, MAX(store_display_name) AS store_display_name,
      ${METRICS.revenue} AS net_sales, SUM(quantity) AS units, ${METRICS.bills} AS bill_cuts
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
    GROUP BY billed_by`,
		salesParams(periods, filters),
	);

	const purchaseRows = hasPurchase
		? await (db as any).query(
				`SELECT billed_by, SUM(net_purchase_amount) AS net_purchase
        FROM purchase_fact_v
        WHERE purchase_date >= $1::date AND purchase_date <= $2::date
          AND ($3::text IS NULL OR billed_by = $3)
          AND ($4::text IS NULL OR category = $4)
          AND ($5::text IS NULL OR brand = $5)
          AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
          AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
        GROUP BY billed_by`,
				salesParams(periods, filters),
			)
		: [];

	const purchaseMap = new Map<string, number>();
	for (const p of purchaseRows) {
		purchaseMap.set(String(p.billed_by), toNumber(p.net_purchase));
	}

	return salesRows
		.map((s: any): StoreProfitabilityRow => {
			const netPurchase = purchaseMap.get(String(s.billed_by)) ?? 0;
			const block = buildProfitability(s.net_sales, netPurchase, hasPurchase);
			return {
				billedBy: String(s.billed_by),
				storeDisplayName: String(s.store_display_name || s.billed_by),
				netSales: block.netSales,
				netPurchase: block.netPurchase,
				grossProfit: block.grossProfit,
				marginPercent: block.marginPercent,
				units: toNumber(s.units),
				billCuts: toNumber(s.bill_cuts),
				hasPurchase: block.hasPurchase,
			};
		})
		.sort(
			(a: StoreProfitabilityRow, b: StoreProfitabilityRow) =>
				b.grossProfit - a.grossProfit,
		);
}

export interface BrandProfitabilityRow {
	brand: string;
	netSales: number;
	netPurchase: number;
	grossProfit: number;
	marginPercent: number | null;
	units: number;
	hasPurchase: boolean;
}

export async function getBrandProfitability(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
): Promise<BrandProfitabilityRow[]> {
	const hasPurchase = await hasPurchaseData(db);

	const salesRows = await (db as any).query(
		`SELECT brand, ${METRICS.revenue} AS net_sales, SUM(quantity) AS units
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
      AND brand IS NOT NULL
    GROUP BY brand`,
		salesParams(periods, filters),
	);

	const purchaseRows = hasPurchase
		? await (db as any).query(
				`SELECT brand, SUM(net_purchase_amount) AS net_purchase
        FROM purchase_fact_v
        WHERE purchase_date >= $1::date AND purchase_date <= $2::date
          AND ($3::text IS NULL OR billed_by = $3)
          AND ($4::text IS NULL OR category = $4)
          AND ($5::text IS NULL OR brand = $5)
          AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
          AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
          AND brand IS NOT NULL
        GROUP BY brand`,
				salesParams(periods, filters),
			)
		: [];

	const purchaseMap = new Map<string, number>();
	for (const p of purchaseRows) {
		purchaseMap.set(String(p.brand), toNumber(p.net_purchase));
	}

	return salesRows
		.map((s: any): BrandProfitabilityRow => {
			const netPurchase = purchaseMap.get(String(s.brand)) ?? 0;
			const block = buildProfitability(s.net_sales, netPurchase, hasPurchase);
			return {
				brand: String(s.brand || "Unknown"),
				netSales: block.netSales,
				netPurchase: block.netPurchase,
				grossProfit: block.grossProfit,
				marginPercent: block.marginPercent,
				units: toNumber(s.units),
				hasPurchase: block.hasPurchase,
			};
		})
		.sort(
			(a: BrandProfitabilityRow, b: BrandProfitabilityRow) =>
				b.grossProfit - a.grossProfit,
		);
}

export interface SkuProfitabilityRow {
	productKey: string;
	skuCode: string | null;
	itemName: string;
	brand: string | null;
	category: string | null;
	netSales: number;
	cogs: number;
	grossProfit: number;
	marginPercent: number | null;
	units: number;
	hasPurchase: boolean;
}

export async function getSkuProfitability(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
	limit = 20,
): Promise<SkuProfitabilityRow[]> {
	const hasPurchase = await hasPurchaseData(db);

	const salesRows = await (db as any).query(
		`SELECT product_key, MAX(item_name) AS item_name, MAX(sku_code) AS sku_code,
      MAX(brand) AS brand, MAX(category) AS category,
      ${METRICS.revenue} AS net_sales, SUM(quantity) AS units
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
    GROUP BY product_key`,
		salesParams(periods, filters),
	);

	const purchaseRows = hasPurchase
		? await (db as any).query(
				`SELECT product_key, SUM(net_purchase_amount) AS net_purchase
        FROM purchase_fact_v
        WHERE purchase_date >= $1::date AND purchase_date <= $2::date
          AND ($3::text IS NULL OR billed_by = $3)
          AND ($4::text IS NULL OR category = $4)
          AND ($5::text IS NULL OR brand = $5)
          AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
          AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
        GROUP BY product_key`,
				salesParams(periods, filters),
			)
		: [];

	const purchaseMap = new Map<string, number>();
	for (const p of purchaseRows) {
		purchaseMap.set(String(p.product_key), toNumber(p.net_purchase));
	}

	return (
		salesRows
			.map((s: any): SkuProfitabilityRow => {
				const netPurchase = purchaseMap.get(String(s.product_key)) ?? 0;
				const block = buildProfitability(s.net_sales, netPurchase, hasPurchase);
				return {
					productKey: String(s.product_key),
					skuCode: s.sku_code ? String(s.sku_code) : null,
					itemName: String(s.item_name || "Unknown product"),
					brand: s.brand ? String(s.brand) : null,
					category: s.category ? String(s.category) : null,
					netSales: block.netSales,
					cogs: block.netPurchase,
					grossProfit: block.grossProfit,
					marginPercent: block.marginPercent,
					units: toNumber(s.units),
					hasPurchase: block.hasPurchase,
				};
			})
			// Ranking: profit descending (a low-revenue high-margin SKU outranks a
			// high-revenue thin-margin one).
			.sort(
				(a: SkuProfitabilityRow, b: SkuProfitabilityRow) =>
					b.grossProfit - a.grossProfit,
			)
			.slice(0, limit)
	);
}

export interface CategoryProfitabilityRow {
	category: string;
	netSales: number;
	netPurchase: number;
	grossProfit: number;
	marginPercent: number | null;
	billCuts: number;
	aov: number;
	profitPerBill: number | null;
	hasPurchase: boolean;
}

export async function getCategoryProfitability(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
): Promise<CategoryProfitabilityRow[]> {
	const hasPurchase = await hasPurchaseData(db);

	const salesRows = await (db as any).query(
		`SELECT category, ${METRICS.revenue} AS net_sales, ${METRICS.bills} AS bill_cuts
    FROM sales_fact_v
    WHERE sale_date >= $1::date AND sale_date <= $2::date
      AND ($3::text IS NULL OR billed_by = $3)
      AND ($4::text IS NULL OR category = $4)
      AND ($5::text IS NULL OR brand = $5)
      AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
      AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
      AND category IS NOT NULL
    GROUP BY category`,
		salesParams(periods, filters),
	);

	const purchaseRows = hasPurchase
		? await (db as any).query(
				`SELECT category, SUM(net_purchase_amount) AS net_purchase
        FROM purchase_fact_v
        WHERE purchase_date >= $1::date AND purchase_date <= $2::date
          AND ($3::text IS NULL OR billed_by = $3)
          AND ($4::text IS NULL OR category = $4)
          AND ($5::text IS NULL OR brand = $5)
          AND ($6::text IS NULL OR (sku_code ILIKE '%' || $6 || '%' OR item_name ILIKE '%' || $6 || '%'))
          AND ($7::text[] IS NULL OR category <> ALL($7::text[]))
          AND category IS NOT NULL
        GROUP BY category`,
				salesParams(periods, filters),
			)
		: [];

	const purchaseMap = new Map<string, number>();
	for (const p of purchaseRows) {
		purchaseMap.set(String(p.category), toNumber(p.net_purchase));
	}

	return salesRows
		.map((s: any): CategoryProfitabilityRow => {
			const netPurchase = purchaseMap.get(String(s.category)) ?? 0;
			const block = buildProfitability(s.net_sales, netPurchase, hasPurchase);
			const billCuts = toNumber(s.bill_cuts);
			const aov =
				billCuts > 0 ? Math.round((block.netSales / billCuts) * 100) / 100 : 0;
			return {
				category: String(s.category),
				netSales: block.netSales,
				netPurchase: block.netPurchase,
				grossProfit: block.grossProfit,
				marginPercent: block.marginPercent,
				billCuts,
				aov,
				profitPerBill: block.hasPurchase
					? profitPerBill(block.grossProfit, billCuts)
					: null,
				hasPurchase: block.hasPurchase,
			};
		})
		.sort(
			(a: CategoryProfitabilityRow, b: CategoryProfitabilityRow) =>
				b.grossProfit - a.grossProfit,
		);
}
