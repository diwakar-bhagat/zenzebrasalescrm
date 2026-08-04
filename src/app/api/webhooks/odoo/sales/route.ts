import { type NextRequest, NextResponse } from "next/server";
import { ingestSalesLines } from "@/lib/erp/ingest-sales";
import { resolveStore } from "@/lib/erp/store-resolver";
import type { CanonicalSaleLine } from "@/lib/erp/types";
import { logWebhookEvent } from "@/lib/erp/webhook-log";

/**
 * POST /api/webhooks/odoo/sales — pre-mapped sales payload (Make.com / Zapier shape).
 *
 * The primary endpoint (/api/webhooks/odoo) handles Odoo's native notifications directly and
 * is the recommended integration. This route remains for relays that post an already-mapped
 * order, and now shares the same ingestion path so both produce identical rows.
 *
 * Expected body:
 * {
 *   order_name, sale_date, store_name, customer_name?, customer_mobile?, payment_method?,
 *   lines: [{ product_key, sku_code?, item_name, category?, brand?, quantity,
 *             mrp_amount?, discount_amount?, gross_amount?, tax_amount?, net_amount? }]
 * }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/webhooks/odoo/sales";

function toNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
	const startedAt = Date.now();

	let body: Record<string, unknown> | null = null;
	let parseError: string | null = null;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		parseError = "Body was not valid JSON";
	}

	// Fail closed, and record the rejection so a misconfigured relay is visible.
	const expected = process.env.ODOO_WEBHOOK_SECRET;
	const allowInsecure = process.env.ODOO_WEBHOOK_ALLOW_INSECURE === "true";
	const provided = req.headers.get("x-webhook-secret");
	if (!(expected ? provided === expected : allowInsecure)) {
		await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "REJECTED_AUTH",
			payload: body,
			error: expected
				? "Invalid or missing x-webhook-secret header"
				: "ODOO_WEBHOOK_SECRET is not configured on the server",
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (parseError || !body) {
		await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "INVALID_PAYLOAD",
			error: parseError ?? "Empty body",
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json(
			{ error: parseError ?? "Empty body" },
			{ status: 400 },
		);
	}

	const orderName = body.order_name as string | undefined;
	const saleDate = body.sale_date as string | undefined;
	const storeName = body.store_name as string | undefined;
	const lines = Array.isArray(body.lines)
		? (body.lines as Record<string, unknown>[])
		: [];

	if (!orderName || !saleDate || !storeName || lines.length === 0) {
		const error =
			"Missing required fields: order_name, sale_date, store_name, lines";
		await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "INVALID_PAYLOAD",
			payload: body,
			error,
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json({ error }, { status: 400 });
	}

	const eventId = await logWebhookEvent({
		endpoint: ENDPOINT,
		status: "RECEIVED",
		payload: body,
		model: "sale.order",
	});

	try {
		const { canonicalStore, storeId } = await resolveStore(storeName);
		// The relay supplies no Odoo write_date, so the event instant is the sale date. This
		// makes reflection time meaningless for this path, which is correct: a batched relay
		// is not a real-time delivery and should not inflate the live-latency percentiles.
		const rows: CanonicalSaleLine[] = lines
			.filter(
				(line) => line.product_key && line.item_name && line.quantity != null,
			)
			.map((line) => {
				const mrp = toNumber(line.mrp_amount);
				const discount = toNumber(line.discount_amount);
				const gross = toNumber(line.gross_amount, mrp - discount);
				const tax = toNumber(line.tax_amount);
				return {
					sale_date: saleDate,
					bill_no: orderName,
					billed_by: canonicalStore,
					source_billed_by: storeName,
					store_id: storeId,
					product_key: String(line.product_key),
					sku_code: (line.sku_code as string) ?? null,
					item_name: String(line.item_name),
					category: (line.category as string) ?? "POS General",
					brand: (line.brand as string) ?? "Odoo POS",
					quantity: toNumber(line.quantity, 1),
					mrp_amount: mrp,
					discount_amount: discount,
					gross_amount: gross,
					tax_amount: tax,
					net_amount: toNumber(line.net_amount, gross + tax),
					payment_method: (body.payment_method as string) ?? "POS Cash/Card",
					customer_mobile: (body.customer_mobile as string) ?? null,
					customer_name: (body.customer_name as string) ?? null,
					source_event_at: null,
				};
			});

		if (rows.length === 0) {
			throw new Error(
				"No lines had the required product_key, item_name and quantity",
			);
		}

		const { upserted } = await ingestSalesLines(rows, "odoo_webhook", eventId);

		await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "PROCESSED",
			payload: { order_name: orderName, lines: rows.length },
			model: "sale.order",
			rowsUpserted: upserted,
			storeName: canonicalStore,
			latencyMs: Date.now() - startedAt,
		});

		return NextResponse.json({ success: true, upserted, order: orderName });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		console.error("[webhook/odoo/sales] error:", error);
		await logWebhookEvent({
			endpoint: ENDPOINT,
			status: "FAILED",
			payload: body,
			model: "sale.order",
			error: message,
			latencyMs: Date.now() - startedAt,
		});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function GET() {
	return NextResponse.json({
		status: "active",
		endpoint: ENDPOINT,
		service: "ZenZebra pre-mapped sales relay receiver",
		note: "Prefer /api/webhooks/odoo for native Odoo notifications.",
	});
}
