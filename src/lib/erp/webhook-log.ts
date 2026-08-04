import { sql } from "../db";
import type { WebhookStatus } from "./types";

/**
 * Webhook delivery log.
 *
 * Every inbound delivery is recorded here — including rejected and malformed ones — because
 * without it a failing webhook is invisible. That is how the Odoo integration came to sit at
 * zero successful deliveries with nothing anywhere explaining why.
 *
 * This table is also the telemetry source for the sync-health engine: event counts, success
 * rate and last-event time all derive from it.
 *
 * Column names match the live webhook_events table (model / record_id / error / latency_ms),
 * not the ERP-namespaced names used elsewhere in this module.
 */

export interface WebhookEventInput {
	endpoint: string;
	status: WebhookStatus;
	payload?: unknown;
	model?: string | null;
	recordId?: number | null;
	error?: string | null;
	rowsUpserted?: number;
	/** When the event occurred in Odoo (write_date). Drives reflection time. */
	sourceEventAt?: string | null;
	/** Server-side handler duration, not reflection time. */
	latencyMs?: number | null;
	storeName?: string | null;
}

/** Oversized payloads are truncated rather than rejected — the log must never be what fails. */
const MAX_PAYLOAD_BYTES = 100_000;

function safePayload(payload: unknown): string {
	try {
		const serialized = JSON.stringify(payload ?? null);
		if (serialized.length > MAX_PAYLOAD_BYTES) {
			return JSON.stringify({
				_truncated: true,
				_originalBytes: serialized.length,
				preview: serialized.slice(0, 2000),
			});
		}
		return serialized;
	} catch {
		return JSON.stringify({ _unserializable: true });
	}
}

/**
 * Records one delivery and returns its id, or null if logging itself failed.
 *
 * Never throws: a logging failure must not turn a good delivery into a 500, and must not mask
 * the original error on a bad one.
 */
export async function logWebhookEvent(
	input: WebhookEventInput,
): Promise<number | null> {
	try {
		// Anything other than RECEIVED is a terminal outcome, so the row is complete on insert.
		const processedAt =
			input.status === "RECEIVED" ? null : new Date().toISOString();
		const rows = await sql`
			INSERT INTO webhook_events (
				endpoint, model, record_id, payload, status, error,
				rows_upserted, source_event_at, latency_ms, store_name,
				received_at, processed_at
			) VALUES (
				${input.endpoint}, ${input.model ?? null}, ${input.recordId ?? null},
				${safePayload(input.payload)}::jsonb, ${input.status}, ${input.error ?? null},
				${input.rowsUpserted ?? 0}, ${input.sourceEventAt ?? null},
				${input.latencyMs ?? null}, ${input.storeName ?? null},
				NOW(), ${processedAt}::timestamptz
			)
			RETURNING id
		`;
		return rows[0]?.id !== undefined ? Number(rows[0].id) : null;
	} catch (error) {
		console.error("[webhook-log] failed to record event:", error);
		return null;
	}
}
