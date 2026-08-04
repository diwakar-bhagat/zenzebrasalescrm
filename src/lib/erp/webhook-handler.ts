import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "../db";
import { OdooClient } from "../odoo-client";
import { publishRealtimeEvent } from "../realtime/publisher";
import { ingestSalesLines } from "./ingest-sales";
import {
	extractModel,
	extractRecordId,
	normalizeOdooOrder,
} from "./normalize-odoo-order";
import { fetchOrderById } from "./odoo-fetch";
import type { OdooPosOrder, OdooPosOrderLine } from "./types";
import { logWebhookEvent } from "./webhook-log";

/**
 * Shared Odoo webhook ingestion.
 *
 * Two routes reach this handler with different authentication, because Odoo's webhook action
 * exposes only a URL — it has no field for headers:
 *
 *   /api/webhooks/odoo            header  `x-webhook-secret` (relays, curl, tests)
 *   /api/webhooks/odoo/<token>    path segment                (Odoo's native action)
 *
 * The path form is the same pattern Slack uses for incoming webhooks. It is transmitted over
 * TLS, so it is not visible on the wire; it does appear in server request logs, which is the
 * accepted trade-off for a sender that cannot set headers. Rotate by changing the URL.
 */

export type AuthResult = { ok: true } | { ok: false; reason: string };

/** Constant-time comparison so a wrong secret cannot be discovered by timing the response. */
export function secretMatches(
	provided: string | null,
	expected: string,
): boolean {
	if (!provided) return false;
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/**
 * Fails closed: with no secret configured the endpoint rejects everything rather than accepting
 * anonymous writes into sales_fact. Local development opts out explicitly.
 */
export function authorise(provided: string | null): AuthResult {
	const expected = process.env.ODOO_WEBHOOK_SECRET;

	if (!expected) {
		if (process.env.ODOO_WEBHOOK_ALLOW_INSECURE === "true") return { ok: true };
		return {
			ok: false,
			reason: "ODOO_WEBHOOK_SECRET is not configured on the server",
		};
	}

	return secretMatches(provided, expected)
		? { ok: true }
		: { ok: false, reason: "Invalid or missing webhook secret" };
}

/** Odoo may deliver a single record or a list; normalise to an array. */
function toRecords(body: unknown): Record<string, unknown>[] {
	if (Array.isArray(body)) {
		return body.filter(
			(r): r is Record<string, unknown> => Boolean(r) && typeof r === "object",
		);
	}
	if (body && typeof body === "object")
		return [body as Record<string, unknown>];
	return [];
}

/**
 * True only when the payload already carries expanded line *objects*.
 *
 * Odoo's `lines` field is one2many, so even a payload with 92 fields selected sends line ids
 * (`"lines": [4711, 4712]`), not line records. Treating that as complete collapses the order
 * into a single summary row and throws away product, category and quantity — which is exactly
 * the detail the dashboard exists to show. Only inline objects count.
 */
function inlineLines(
	record: Record<string, unknown>,
): OdooPosOrderLine[] | null {
	const candidate = record.line_details ?? record.lines;
	if (!Array.isArray(candidate) || candidate.length === 0) return null;
	const allObjects = candidate.every(
		(l) => l && typeof l === "object" && !Array.isArray(l),
	);
	return allObjects ? (candidate as OdooPosOrderLine[]) : null;
}

/** Mirrors the latest webhook outcome onto the shared sync cursor for the health engine. */
async function recordWebhookHealth(
	status: string,
	latencyMs: number,
): Promise<void> {
	try {
		await sql`
			INSERT INTO sync_cursors (service_name, last_sync_at, last_webhook_at, last_webhook_latency_ms, last_webhook_status)
			VALUES ('odoo_pos_sync', NOW(), NOW(), ${latencyMs}, ${status})
			ON CONFLICT (service_name) DO UPDATE SET
				last_webhook_at = NOW(),
				last_webhook_latency_ms = EXCLUDED.last_webhook_latency_ms,
				last_webhook_status = EXCLUDED.last_webhook_status
		`;
	} catch (error) {
		console.error("[webhook/odoo] failed to update sync cursor:", error);
	}
}

/** Closes out a RECEIVED event row with its terminal outcome. */
async function finaliseEvent(
	eventId: number | null,
	fields: {
		status: "PROCESSED" | "FAILED";
		error?: string | null;
		rowsUpserted?: number;
		sourceEventAt?: string | null;
		storeName?: string | null;
		latencyMs: number;
	},
): Promise<void> {
	if (eventId === null) return;
	try {
		await sql`
			UPDATE webhook_events
			SET status = ${fields.status}, processed_at = NOW(), latency_ms = ${fields.latencyMs},
				error = ${fields.error ?? null}, rows_upserted = ${fields.rowsUpserted ?? 0},
				source_event_at = ${fields.sourceEventAt ?? null}, store_name = ${fields.storeName ?? null}
			WHERE id = ${eventId}
		`;
	} catch (error) {
		console.error("[webhook/odoo] failed to finalise event:", error);
	}
}

/**
 * Ingests an Odoo webhook delivery.
 *
 * Every delivery is written to webhook_events regardless of outcome, including ones rejected
 * before processing. Silent rejection is what previously made a broken integration
 * indistinguishable from an idle one.
 */
export async function handleOdooWebhook(
	req: NextRequest,
	endpoint: string,
	providedSecret: string | null,
): Promise<NextResponse> {
	const startedAt = Date.now();

	// Read the body before authorising so a rejected delivery is still logged with what was sent.
	let rawBody: unknown = null;
	let parseError: string | null = null;
	try {
		rawBody = await req.json();
	} catch {
		parseError = "Body was not valid JSON";
	}

	const auth = authorise(providedSecret);
	if (!auth.ok) {
		await logWebhookEvent({
			endpoint,
			status: "REJECTED_AUTH",
			payload: rawBody,
			error: auth.reason,
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json(
			{ error: "Unauthorized", detail: auth.reason },
			{ status: 401 },
		);
	}

	if (parseError) {
		await logWebhookEvent({
			endpoint,
			status: "INVALID_PAYLOAD",
			error: parseError,
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json({ error: parseError }, { status: 400 });
	}

	const records = toRecords(rawBody);
	if (records.length === 0) {
		await logWebhookEvent({
			endpoint,
			status: "INVALID_PAYLOAD",
			payload: rawBody,
			error: "Payload contained no records",
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json(
			{ error: "Payload contained no records" },
			{ status: 400 },
		);
	}

	let totalUpserted = 0;
	let hydratedAny = false;
	const processed: { bill: string; rows: number }[] = [];

	for (const record of records) {
		const model = extractModel(record) ?? "pos.order";
		const recordId = extractRecordId(record);

		if (model !== "pos.order" && model !== "sale.order") {
			await logWebhookEvent({
				endpoint,
				status: "IGNORED",
				payload: record,
				model,
				recordId,
				error: `Model ${model} is not handled by this endpoint`,
				latencyMs: Date.now() - startedAt,
			});
			continue;
		}

		const eventId = await logWebhookEvent({
			endpoint,
			status: "RECEIVED",
			payload: record,
			model,
			recordId,
		});

		try {
			let order = record as OdooPosOrder;
			let lines = inlineLines(record) ?? [];

			// Read the order back from Odoo whenever we do not already hold real line objects.
			// This is what turns a notification into a complete sale: correct products,
			// categories, quantities and discounts, rather than a single synthetic summary row.
			if (lines.length === 0) {
				if (recordId === null) {
					throw new Error(
						"Payload has no usable record id (expected `id` or `_id`) and no inline line data",
					);
				}
				if (!OdooClient.isConfigured()) {
					throw new Error(
						"Cannot hydrate the order: Odoo API is not configured. Set ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_PASSWORD.",
					);
				}

				const hydrated = await fetchOrderById(new OdooClient(), recordId);
				if (!hydrated)
					throw new Error(`pos.order ${recordId} not found in Odoo`);

				// Prefer Odoo's own record over the payload: the webhook may have been queued
				// before a later edit, and the read-back is authoritative.
				order = { ...order, ...hydrated.order };
				lines = hydrated.lines;
				hydratedAny = true;
			}

			const canonical = await normalizeOdooOrder(order, lines);
			if (canonical.length === 0) {
				throw new Error(
					"Order produced no ingestible lines (missing both name and id)",
				);
			}

			const { upserted, unresolvedStores } = await ingestSalesLines(
				canonical,
				"odoo_webhook",
				eventId,
			);
			totalUpserted += upserted;
			processed.push({ bill: canonical[0].bill_no, rows: upserted });

			// Notify dashboards only after the write has committed. Publishing earlier would
			// have subscribers refetch rows that are not visible yet, and they would never be
			// told again. Failures here are swallowed: realtime is a latency optimisation, and
			// losing a notification must never turn an ingested sale into a 500.
			await publishRealtimeEvent({
				name: "sale.ingested",
				store: canonical[0].billed_by,
				rows: upserted,
				billNo: canonical[0].bill_no,
				eventId: eventId ?? canonical[0].bill_no,
			});

			await finaliseEvent(eventId, {
				status: "PROCESSED",
				rowsUpserted: upserted,
				sourceEventAt: canonical[0].source_event_at,
				storeName: canonical[0].billed_by,
				latencyMs: Date.now() - startedAt,
				error:
					unresolvedStores.length > 0
						? `Ingested, but store not found in store_dimension: ${unresolvedStores.join(", ")}`
						: null,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown ingestion error";
			console.error("[webhook/odoo] ingestion failed:", error);
			await finaliseEvent(eventId, {
				status: "FAILED",
				error: message,
				latencyMs: Date.now() - startedAt,
			});
			await recordWebhookHealth("FAILED", Date.now() - startedAt);
			return NextResponse.json({ error: message, eventId }, { status: 500 });
		}
	}

	const latencyMs = Date.now() - startedAt;
	await recordWebhookHealth("PROCESSED", latencyMs);

	return NextResponse.json({
		success: true,
		upserted: totalUpserted,
		hydratedViaJsonRpc: hydratedAny,
		records: processed,
		latencyMs,
	});
}

/** Shared status payload for the GET probes on both routes. */
export async function webhookStatus(endpoint: string) {
	const recentEvents = await sql`
		SELECT id, received_at, processed_at, latency_ms, status, model, record_id, rows_upserted, error
		FROM webhook_events ORDER BY received_at DESC LIMIT 10
	`;
	return {
		status: "active",
		endpoint,
		service: "ZenZebra Odoo ingestion receiver",
		model: "pos.order",
		secretConfigured: Boolean(process.env.ODOO_WEBHOOK_SECRET),
		canHydrateThinPayloads: OdooClient.isConfigured(),
		recentEvents,
	};
}
