import { sql } from "../db";
import { OdooClient } from "../odoo-client";

/**
 * ERP sync health engine.
 *
 * Reports what the pipeline is actually doing. Every field here is measured; nothing is
 * defaulted to a plausible-looking constant. Where a metric cannot be computed from real
 * events — most importantly reflection time before any webhook has ever been delivered — the
 * field is null and the UI says so, rather than showing an invented millisecond figure.
 */

/** How the data most recently arrived. Not a quality judgement — a statement of fact. */
export type SyncMode = "live" | "scheduled" | "delayed" | "offline";

export type SlaState = "met" | "warning" | "breached";

export interface ReflectionStats {
	p50Ms: number;
	p95Ms: number;
	sampleSize: number;
}

export interface SlaStats {
	targetMs: number;
	metPct: number;
	state: SlaState;
	sampleSize: number;
}

export interface SyncHealth {
	mode: SyncMode;
	erp: { name: string; url: string | null; configured: boolean };
	webhook: {
		secretConfigured: boolean;
		lastEventAt: string | null;
		lastSuccessAt: string | null;
		eventsToday: number;
		successRate24h: number | null;
		failures24h: number;
		lastError: string | null;
	};
	sync: {
		lastRunAt: string | null;
		lastSuccessAt: string | null;
		recordsLastRun: number;
		consecutiveFailures: number;
		lastError: string | null;
		cadence: string;
	};
	data: {
		latestSaleDate: string | null;
		lastIngestedAt: string | null;
		rowsToday: number;
		totalRows: number;
	};
	reflection: ReflectionStats | null;
	sla: SlaStats | null;
	stores: {
		name: string;
		lastSaleDate: string | null;
		rowsLast7Days: number;
	}[];
	apiLatencyMs: number;
	generatedAt: string;
}

/**
 * How often the reconciliation pull runs, in minutes. Must match the scheduler's interval.
 *
 * Webhooks are the primary path and deliver a sale in about a second. The pull is the safety
 * net: every run re-covers everything since the stored cursor, so a delivery lost to a deploy,
 * a network blip or an outage is recovered automatically rather than disappearing.
 */
export const SYNC_INTERVAL_MINUTES = Number(
	process.env.SYNC_INTERVAL_MINUTES ?? 5,
);

const MINUTE_MS = 60 * 1000;
const EXPECTED_MS = SYNC_INTERVAL_MINUTES * MINUTE_MS;

/** One missed tick is normal scheduler jitter. */
const HEALTHY_MS = EXPECTED_MS * 2;
/** Several missed ticks: worth showing, not yet an outage. */
const LATE_MS = EXPECTED_MS * 6;
/** Beyond this the pipeline is not running. */
const OFFLINE_MS = Math.max(EXPECTED_MS * 12, 60 * MINUTE_MS);

/**
 * Target for an Odoo sale to become a visible row.
 *
 * Deliberately set far below the poll interval. A webhook lands in roughly a second, so any
 * sale exceeding this budget almost certainly had its webhook missed and was recovered by
 * reconciliation instead. The on-time rate therefore doubles as the real answer to "is my
 * real-time pipeline actually working?" — a number that would be meaningless if the target
 * were loose enough for the fallback to satisfy it.
 */
const SLA_TARGET_MS = Number(process.env.SLA_TARGET_SECONDS ?? 30) * 1000;
/**
 * Below this many samples a percentage is noise, not a signal — one event would read as
 * either 100% or 0% SLA compliance. The UI shows "collecting data" instead.
 */
const MIN_SLA_SAMPLE = 20;

function toIso(value: unknown): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ageMs(iso: string | null): number | null {
	if (!iso) return null;
	return Date.now() - new Date(iso).getTime();
}

/**
 * Classifies the pipeline's actual state.
 *
 * Health is measured by **when the pipeline last ran**, not when data last changed. Those are
 * different things: the shops close overnight, so no new sales arrive for hours while the sync
 * is working perfectly. Keying off the newest row would raise a false outage every night.
 *
 * A successful pull that found zero new orders is a healthy pull. Data recency is reported
 * separately, as information rather than as a verdict.
 */
function classifyMode(
	lastSyncSuccessAt: string | null,
	lastWebhookSuccessAt: string | null,
	consecutiveFailures: number,
): SyncMode {
	if (consecutiveFailures >= 3) return "offline";

	// Either mechanism proves the pipeline is alive; take whichever ran most recently.
	const ages = [ageMs(lastSyncSuccessAt), ageMs(lastWebhookSuccessAt)].filter(
		(a): a is number => a !== null,
	);
	if (ages.length === 0) return "offline";

	const age = Math.min(...ages);
	if (age < HEALTHY_MS) return "live";
	if (age < LATE_MS) return "scheduled";
	if (age < OFFLINE_MS) return "delayed";
	return "offline";
}

function classifySla(metPct: number): SlaState {
	if (metPct >= 95) return "met";
	if (metPct >= 90) return "warning";
	return "breached";
}

export async function getSyncHealth(): Promise<SyncHealth> {
	const probeStart = Date.now();

	const [
		webhookAgg,
		lastFailure,
		cursorRows,
		dataAgg,
		reflectionRows,
		storeRows,
	] = await Promise.all([
		// Delivery counts over the last 24h. RECEIVED rows are in-flight and excluded from the
		// success-rate denominator so a request being processed cannot look like a failure.
		sql`
			SELECT
				MAX(received_at) FILTER (WHERE status = 'PROCESSED')                       AS last_success_at,
				MAX(received_at)                                                            AS last_event_at,
				COUNT(*) FILTER (WHERE received_at >= CURRENT_DATE)::int                    AS events_today,
				COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '24 hours'
					AND status <> 'RECEIVED')::int                                          AS attempts_24h,
				COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '24 hours'
					AND status = 'PROCESSED')::int                                          AS successes_24h,
				COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '24 hours'
					AND status IN ('FAILED', 'REJECTED_AUTH', 'INVALID_PAYLOAD'))::int      AS failures_24h
			FROM webhook_events
		`,
		sql`
			SELECT error, received_at FROM webhook_events
			WHERE status IN ('FAILED', 'REJECTED_AUTH', 'INVALID_PAYLOAD') AND error IS NOT NULL
			ORDER BY received_at DESC LIMIT 1
		`,
		sql`
			SELECT last_sync_at, last_success_at, last_attempt_at, last_error,
				consecutive_failures, records_synced
			FROM sync_cursors WHERE service_name = 'odoo_pos_sync' LIMIT 1
		`,
		sql`
			SELECT MAX(sale_date)::text AS latest_sale_date,
				MAX(ingested_at)         AS last_ingested_at,
				COUNT(*)::int            AS total_rows,
				COUNT(*) FILTER (WHERE sale_date = CURRENT_DATE)::int AS rows_today
			FROM sales_fact
		`,
		// Reflection time: Odoo write_date -> row visible here.
		//
		// Measured across every ERP path, not just webhooks. Under a pull-based pipeline the
		// dominant term is where in the polling cycle a sale lands, and that IS the latency a
		// founder experiences. Restricting this to webhook rows would report nothing at all.
		//
		// Rows where source_event_at is ahead of ingested_at are excluded rather than counted
		// as negative: that means Odoo's clock ran ahead of ours, not a sub-zero latency.
		sql`
			SELECT
				PERCENTILE_CONT(0.5) WITHIN GROUP (
					ORDER BY EXTRACT(EPOCH FROM (ingested_at - source_event_at)) * 1000)  AS p50_ms,
				PERCENTILE_CONT(0.95) WITHIN GROUP (
					ORDER BY EXTRACT(EPOCH FROM (ingested_at - source_event_at)) * 1000)  AS p95_ms,
				COUNT(*)::int                                                            AS sample_size,
				COUNT(*) FILTER (
					WHERE EXTRACT(EPOCH FROM (ingested_at - source_event_at)) * 1000 <= ${SLA_TARGET_MS}
				)::int                                                                   AS within_sla
			FROM sales_fact
			WHERE source_system IN ('odoo_webhook', 'odoo_sync')
				AND source_event_at IS NOT NULL
				AND ingested_at >= NOW() - INTERVAL '24 hours'
				AND ingested_at >= source_event_at
				-- Both ends must be recent. A historical backfill re-ingests old orders *now*,
				-- which would otherwise register as multi-day "latency" and swamp the real
				-- steady-state figure. Only sales that actually happened recently are measured.
				AND source_event_at >= NOW() - INTERVAL '24 hours'
		`,
		sql`
			SELECT billed_by AS name,
				MAX(sale_date)::text AS last_sale_date,
				COUNT(*) FILTER (WHERE sale_date >= CURRENT_DATE - 7)::int AS rows_last_7_days
			FROM sales_fact_v
			GROUP BY billed_by ORDER BY billed_by
		`,
	]);

	const apiLatencyMs = Date.now() - probeStart;

	const wh = webhookAgg[0] ?? {};
	const cursor = cursorRows[0] ?? {};
	const data = dataAgg[0] ?? {};
	const refl = reflectionRows[0] ?? {};

	const attempts24h = Number(wh.attempts_24h ?? 0);
	const successes24h = Number(wh.successes_24h ?? 0);
	const successRate24h =
		attempts24h > 0
			? Math.round((successes24h / attempts24h) * 1000) / 10
			: null;

	const lastWebhookSuccessAt = toIso(wh.last_success_at);
	const lastSyncSuccessAt = toIso(
		cursor.last_success_at ?? cursor.last_sync_at,
	);
	const lastIngestedAt = toIso(data.last_ingested_at);
	const consecutiveFailures = Number(cursor.consecutive_failures ?? 0);

	const sampleSize = Number(refl.sample_size ?? 0);
	const reflection: ReflectionStats | null =
		sampleSize > 0 && refl.p50_ms !== null
			? {
					p50Ms: Math.round(Number(refl.p50_ms)),
					p95Ms: Math.round(Number(refl.p95_ms)),
					sampleSize,
				}
			: null;

	const sla: SlaStats | null =
		sampleSize >= MIN_SLA_SAMPLE
			? (() => {
					const metPct =
						Math.round((Number(refl.within_sla ?? 0) / sampleSize) * 1000) / 10;
					return {
						targetMs: SLA_TARGET_MS,
						metPct,
						state: classifySla(metPct),
						sampleSize,
					};
				})()
			: null;

	return {
		mode: classifyMode(
			lastSyncSuccessAt,
			lastWebhookSuccessAt,
			consecutiveFailures,
		),
		erp: {
			name: "Odoo 19 Enterprise SaaS",
			url: process.env.ODOO_URL ?? null,
			configured: OdooClient.isConfigured(),
		},
		webhook: {
			secretConfigured: Boolean(process.env.ODOO_WEBHOOK_SECRET),
			lastEventAt: toIso(wh.last_event_at),
			lastSuccessAt: lastWebhookSuccessAt,
			eventsToday: Number(wh.events_today ?? 0),
			successRate24h,
			failures24h: Number(wh.failures_24h ?? 0),
			lastError: lastFailure[0]?.error ?? null,
		},
		sync: {
			lastRunAt: toIso(cursor.last_attempt_at ?? cursor.last_sync_at),
			lastSuccessAt: lastSyncSuccessAt,
			recordsLastRun: Number(cursor.records_synced ?? 0),
			consecutiveFailures,
			lastError: cursor.last_error ?? null,
			// Reconciliation cadence, driven by an external scheduler because Vercel's Hobby
			// plan caps its own cron at one run per day. Webhooks carry the live traffic.
			cadence: `every ${SYNC_INTERVAL_MINUTES} min`,
		},
		data: {
			latestSaleDate: data.latest_sale_date ?? null,
			lastIngestedAt,
			rowsToday: Number(data.rows_today ?? 0),
			totalRows: Number(data.total_rows ?? 0),
		},
		reflection,
		sla,
		stores: storeRows.map((row) => ({
			name: String(row.name),
			lastSaleDate: row.last_sale_date ?? null,
			rowsLast7Days: Number(row.rows_last_7_days ?? 0),
		})),
		apiLatencyMs,
		generatedAt: new Date().toISOString(),
	};
}
