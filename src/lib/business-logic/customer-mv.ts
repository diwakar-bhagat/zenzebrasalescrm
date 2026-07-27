import type { NeonQueryFunction } from "@neondatabase/serverless";

import type { DashboardFilters } from "@/lib/founder/types";

type FounderSql = NeonQueryFunction<false, false>;

/**
 * Decide whether the lifetime engines may read mv_customer_identity instead of
 * scanning sales_fact_v. The MV is at (identity_key × billed_by) grain, reflects
 * the latest refresh (no historical as-of), and carries no category/brand/sku
 * dimension — so it is valid ONLY when:
 *   • no category / brand / sku / retail-scope filter, and
 *   • the as-of end is at or beyond the latest data date (default "current" view).
 * Store filtering is supported (billed_by lives in the MV).
 *
 * The verify harness proves per-identity MV↔live parity; this gate keeps the MV
 * path strictly within the range where that parity holds.
 */
export async function shouldUseCustomerMv(
	db: FounderSql,
	filters: DashboardFilters,
	currentEnd: string,
): Promise<boolean> {
	if (
		filters.category ||
		filters.brand ||
		filters.sku ||
		filters.categoryScope === "retail"
	) {
		return false;
	}
	const [mv] = await db.query(
		`SELECT COUNT(*)::int AS present FROM pg_matviews WHERE matviewname = 'mv_customer_identity'`,
	);
	if (!mv || Number(mv.present) === 0) return false;

	const [dataRow] = await db.query(
		`SELECT MAX(sale_date)::text AS max_date FROM sales_fact_v`,
	);
	const maxDate = dataRow?.max_date as string | null;
	return Boolean(maxDate && currentEnd >= maxDate);
}
