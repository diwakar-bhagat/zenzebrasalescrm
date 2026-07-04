import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Materialized-view registry + refresh engine (runtime-safe: no script imports).
 * Used by the upload pipeline (in-process, after a successful commit) and by the
 * `refresh:mv` CLI. Extend `MATERIALIZED_VIEWS` as mv_daily_sales, mv_store_summary… land.
 */

export const MATERIALIZED_VIEWS = ["mv_customer_identity"] as const;

type Sql = NeonQueryFunction<false, false>;

export interface RefreshResult {
	view: string;
	ms: number;
	ok: boolean;
	error?: string;
}

/**
 * Refresh every registered MV that exists. Prefers CONCURRENTLY (non-blocking,
 * needs a unique index); falls back to a plain refresh (e.g. first populate).
 * Never throws — returns per-view results so callers can log without failing.
 */
export async function refreshMaterializedViews(
	sql: Sql,
): Promise<RefreshResult[]> {
	const existing = await sql.query(`SELECT matviewname FROM pg_matviews`);
	const present = new Set(
		existing.map((r) => String((r as { matviewname: string }).matviewname)),
	);

	const results: RefreshResult[] = [];
	for (const view of MATERIALIZED_VIEWS) {
		if (!present.has(view)) {
			results.push({
				view,
				ms: 0,
				ok: false,
				error: "not created (run migrate:customer-analytics)",
			});
			continue;
		}
		const t0 = performance.now();
		try {
			await sql.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
			results.push({ view, ms: performance.now() - t0, ok: true });
		} catch {
			try {
				await sql.query(`REFRESH MATERIALIZED VIEW ${view}`);
				results.push({ view, ms: performance.now() - t0, ok: true });
			} catch (e) {
				results.push({
					view,
					ms: performance.now() - t0,
					ok: false,
					error: e instanceof Error ? e.message : String(e),
				});
			}
		}
	}
	return results;
}
