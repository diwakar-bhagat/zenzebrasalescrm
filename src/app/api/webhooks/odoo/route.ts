import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ingestSalesLines } from "@/lib/erp/ingest-sales";
import {
	extractModel,
	extractRecordId,
	isHydratedOrder,
	normalizeOdooOrder,
} from "@/lib/erp/normalize-odoo-order";
import { fetchOrderById } from "@/lib/erp/odoo-fetch";
import type { OdooPosOrder, OdooPosOrderLine } from "@/lib/erp/types";
import { logWebhookEvent } from "@/lib/erp/webhook-log";
import { OdooClient } from "@/lib/odoo-client";

/**
 * POST /api/webhooks/odoo — primary real-time ingestion endpoint.
 *
 * Accepts Odoo 19 Enterprise "Send Webhook Notification" deliveries for pos.order in two shapes:
 *
 *   1. Thin  — {"_model": "pos.order", "_id": 1582}. This is what Odoo's native automation
 *              actually sends: a notification, not the record. The order is read back over
 *              JSON-RPC before ingestion (the Stripe/GitHub notification pattern).
 *   2. Full  — a complete order with date_order / amount_total / lines, e.g. from Make.com.
 *
 * Every delivery is written to webhook_events regardless of outcome — including ones rejected
 * for a bad secret or malformed body. Silent rejection is what previously made a broken
 * integration indistinguishable from an idle one.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/webhooks/odoo";

type AuthResult = { ok: true } | { ok: false; reason: string };

function verifyWebhookSecret(req: NextRequest): AuthResult {
	const expected = process.env.ODOO_WEBHOOK_SECRET;

	if (!expected) {
		// Fail closed. This previously returned "allow" when the secret was unset, leaving an
		// unauthenticated public write path into sales_fact in any environment that forgot to
		// configure it. Local development opts out explicitly instead.
		if (process.env.ODOO_WEBHOOK_ALLOW_INSECURE === "true") return { ok: true };
		return {
			ok: false,
			reason: "ODOO_WEBHOOK_SECRET is not configured on the server",
		};
	}

	// Header only. The query-string form leaked the shared secret into access logs and any
	// intermediary that records URLs.
	const provided =
		req.headers.get("x-webhook-secret") ?? req.headers.get("x-odoo-secret");
	if (provided === expected) return { ok: true };

	return { ok: false, reason: "Invalid or missing x-webhook-secret header" };
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

export async function POST(req: NextRequest) {
	const startedAt = Date.now();

	// Read the body first so a rejected request is still logged with what was actually sent.
	// Authentication is checked after, but before anything is written to sales_fact.
	let rawBody: unknown = null;
	let parseError: string | null = null;
	try {
		rawBody = await req.json();
	} catch {
		parseError = "Body was not valid JSON";
	}

	const auth = verifyWebhookSecret(req);
	if (!auth.ok) {
		await logWebhookEvent({
			endpoint: ENDPOINT,
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
			endpoint: ENDPOINT,
			status: "INVALID_PAYLOAD",
			error: parseError,
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json({ error: parseError }, { status: 400 });
	}

	const records = toRecords(rawBody);
	if (records.length === 0) {
		await logWebhookEvent({
			endpoint: ENDPOINT,
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

		// Only POS orders are ingested here. Anything else is acknowledged and logged as ignored
		// so an over-broad Odoo automation does not masquerade as a failure.
		if (model !== "pos.order" && model !== "sale.order") {
			await logWebhookEvent({
				endpoint: ENDPOINT,
				status: "IGNORED",
				payload: record,
				model,
				recordId,
				error: `Model ${model} is not handled by this endpoint`,
				latencyMs: Date.now() - startedAt,
			});
			continue;
		}

		// Open the event row before doing work, so fact rows can reference it.
		const eventId = await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "RECEIVED",
			payload: record,
			model,
			recordId,
		});

		try {
			let order = record as OdooPosOrder;
			let lines: OdooPosOrderLine[] = Array.isArray(record.line_details)
				? (record.line_details as OdooPosOrderLine[])
				: [];

			// Thin notification: read the record back from Odoo. Without this the handler
			// fabricates a zero-amount order from an id, which is how empty rows appear.
			if (!isHydratedOrder(order)) {
				if (recordId === null) {
					throw new Error(
						"Payload has no usable record id (expected `id` or `_id`) and no inline order data",
					);
				}
				if (!OdooClient.isConfigured()) {
					throw new Error(
						"Received a thin Odoo notification but the Odoo API is not configured; cannot hydrate. Set ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_PASSWORD.",
					);
				}

				const hydrated = await fetchOrderById(new OdooClient(), recordId);
				if (!hydrated)
					throw new Error(`pos.order ${recordId} not found in Odoo`);

				order = hydrated.order;
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

			await finaliseEvent(eventId, {
				status: "PROCESSED",
				rowsUpserted: upserted,
				sourceEventAt: canonical[0].source_event_at,
				storeName: canonical[0].billed_by,
				latencyMs: Date.now() - startedAt,
				// An ingested row with no store_dimension match still counts as delivered, but
				// it is a data-quality problem worth surfacing rather than swallowing.
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
			SET status = ${fields.status},
				processed_at = NOW(),
				latency_ms = ${fields.latencyMs},
				error = ${fields.error ?? null},
				rows_upserted = ${fields.rowsUpserted ?? 0},
				source_event_at = ${fields.sourceEventAt ?? null},
				store_name = ${fields.storeName ?? null}
			WHERE id = ${eventId}
		`;
	} catch (error) {
		console.error("[webhook/odoo] failed to finalise event:", error);
	}
}

export async function GET() {
	const recentEvents = await sql`
		SELECT id, received_at, processed_at, latency_ms, status, model, record_id, rows_upserted, error
		FROM webhook_events
		ORDER BY received_at DESC
		LIMIT 10
	`;

	return NextResponse.json({
		status: "active",
		endpoint: ENDPOINT,
		service: "ZenZebra Odoo ingestion receiver",
		model: "pos.order",
		secretConfigured: Boolean(process.env.ODOO_WEBHOOK_SECRET),
		canHydrateThinPayloads: OdooClient.isConfigured(),
		recentEvents,
	});
}
