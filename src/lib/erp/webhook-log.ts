import { sql } from "@/lib/db";
import type { WebhookStatus } from "./types";

/**
 * Webhook delivery log.
 *
 * Every inbound delivery is recorded here — including rejected and malformed ones — because
 * without it a failing webhook is completely invisible. That is precisely how the Odoo
 * integration came to sit at zero successful deliveries with nothing anywhere explaining why.
 *
 * This table is also the telemetry source for the sync-health engine: event counts, success
 * rate and last-event time all derive from it.
 */

export interface WebhookEventInput {
	endpoint: string;
	status: WebhookStatus;
	payload?: unknown;
	odooModel?: string | null;
	odooRecordId?: number | null;
	errorMessage?: string | null;
	rowsUpserted?: number;
	sourceEventAt?: string | null;
	processingMs?: number | null;
	storeName?: string | null;
}

/** Oversized payloads are truncated rather than rejected — the log must never be the thing that fails. */
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
 * Records one delivery. Never throws: logging failures must not turn a good delivery into a
 * 500, and must not mask the original error on a bad one.
 */
export async function logWebhookEvent(input: WebhookEventInput): Promise<void> {
	try {
		await sql`
			INSERT INTO webhook_events (
				endpoint, source, odoo_model, odoo_record_id, payload,
				status, error_message, rows_upserted, source_event_at, processing_ms, store_name
			) VALUES (
				${input.endpoint}, 'odoo', ${input.odooModel ?? null}, ${input.odooRecordId ?? null},
				${safePayload(input.payload)}::jsonb,
				${input.status}, ${input.errorMessage ?? null}, ${input.rowsUpserted ?? 0},
				${input.sourceEventAt ?? null}, ${input.processingMs ?? null}, ${input.storeName ?? null}
			)
		`;
	} catch (error) {
		console.error("[webhook-log] failed to record event:", error);
	}
}
