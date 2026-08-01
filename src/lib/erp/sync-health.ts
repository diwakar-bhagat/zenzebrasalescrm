import { sql } from "@/lib/db";
import { OdooClient } from "@/lib/odoo-client";

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

/** A webhook delivered inside this window means data is flowing right now. */
const LIVE_WINDOW_MS = 5 * 60 * 1000;
/** The scheduled pull runs daily; allow a couple of hours of slack before calling it late. */
const SCHEDULED_WINDOW_MS = 26 * 60 * 60 * 1000;
const DELAYED_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Target for an Odoo event to become a visible row. */
const SLA_TARGET_MS = 2000;
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
 * "live" requires a recent *successful* webhook — a burst of failing deliveries is not
 * liveness. Everything else degrades by how stale the newest data is, so a dashboard running
 * off yesterday's cron says so instead of claiming real-time it is not delivering.
 */
function classifyMode(
	lastWebhookSuccessAt: string | null,
	lastIngestedAt: string | null,
	consecutiveFailures: number,
	successRate24h: number | null,
): SyncMode {
	if (consecutiveFailures >= 3) return "offline";

	const webhookAge = ageMs(lastWebhookSuccessAt);
	if (webhookAge !== null && webhookAge < LIVE_WINDOW_MS) {
		// Deliveries are arriving but a meaningful share are failing: flowing, not healthy.
		if (successRate24h !== null && successRate24h < 95) return "delayed";
		return "live";
	}

	const ingestAge = ageMs(lastIngestedAt);
	if (ingestAge === null) return "offline";
	if (ingestAge < SCHEDULED_WINDOW_MS) return "scheduled";
	if (ingestAge < DELAYED_WINDOW_MS) return "delayed";
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
		// Reflection time: Odoo write_date -> row visible here. Only webhook-sourced rows have
		// a meaningful source_event_at; the scheduled pull reflects on its cron cadence, so
		// including it would drown the real-time signal in multi-hour values.
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
			WHERE source_system = 'odoo_webhook'
				AND source_event_at IS NOT NULL
				AND ingested_at >= NOW() - INTERVAL '24 hours'
				AND ingested_at >= source_event_at
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
			lastWebhookSuccessAt,
			lastIngestedAt,
			consecutiveFailures,
			successRate24h,
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
			lastSuccessAt: toIso(cursor.last_success_at ?? cursor.last_sync_at),
			recordsLastRun: Number(cursor.records_synced ?? 0),
			consecutiveFailures,
			lastError: cursor.last_error ?? null,
			// Vercel's Hobby plan permits one cron execution per day, so the scheduled pull is a
			// safety net rather than a near-real-time fallback. Webhooks are the only live path.
			cadence: "daily",
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
