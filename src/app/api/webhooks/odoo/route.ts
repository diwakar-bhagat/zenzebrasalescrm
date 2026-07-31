import { type NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db";

/**
 * POST /api/webhooks/odoo
 *
 * Primary Webhook Endpoint for Odoo 19 Enterprise SaaS Native Server Actions.
 * Handles "Send Webhook Notification" actions from Odoo for Point of Sale Orders (`pos.order`)
 * as well as standard Sales Orders (`sale.order`).
 *
 * Supported Headers/Params:
 * - x-webhook-secret header OR ?secret= query param (matches process.env.ODOO_WEBHOOK_SECRET if set)
 *
 * Native Odoo Payload Fields:
 * - id / _id, name, date_order, amount_total, amount_tax, state, config_id, partner_id, write_date, lines
 */

export const runtime = "nodejs";

function verifyWebhookSecret(req: NextRequest): boolean {
	const secretEnv = process.env.ODOO_WEBHOOK_SECRET;
	if (!secretEnv) return true; // If secret not set in env, allow request for initial testing

	const headerSecret = req.headers.get("x-webhook-secret");
	const querySecret = req.nextUrl.searchParams.get("secret");

	return headerSecret === secretEnv || querySecret === secretEnv;
}

/** Utility to safely extract string representation from Odoo M2O tuple [id, name] or string */
function extractOdooRelation(val: any, fallback: string): string {
	if (Array.isArray(val) && val.length > 1 && typeof val[1] === "string") {
		return val[1];
	}
	if (typeof val === "string" && val.trim().length > 0) {
		return val;
	}
	return fallback;
}

export async function POST(req: NextRequest) {
	if (!verifyWebhookSecret(req)) {
		return NextResponse.json({ error: "Unauthorized: Invalid Webhook Secret" }, { status: 401 });
	}

	let body: any;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
	}

	// 1. Extract Order Metadata
	const order_name =
		body.order_name ||
		body.name ||
		(body.id ? `POS-${body.id}` : body._id ? `POS-${body._id}` : null);

	const rawDate = body.sale_date || body.date_order || new Date().toISOString();
	const sale_date = rawDate.split(" ")[0].split("T")[0]; // YYYY-MM-DD format

	const rawStoreName =
		body.store_name ||
		extractOdooRelation(body.config_id, extractOdooRelation(body.company_id, "Head office"));

	const customer_name =
		body.customer_name || extractOdooRelation(body.partner_id, "Walk-in Customer");

	const customer_mobile = body.customer_mobile || body.phone || body.mobile || null;
	const payment_method = body.payment_method || "POS Cash/Card";

	if (!order_name) {
		return NextResponse.json(
			{ error: "Missing required order identifier (id, name, or order_name)" },
			{ status: 400 }
		);
	}

	try {
		// 2. Resolve Canonical Store Name via store_alias_mapping
		const storeResult = await sql`
			SELECT canonical_store FROM store_alias_mapping
			WHERE lower(source_name) = lower(${rawStoreName})
			LIMIT 1
		`;
		const canonicalStore = storeResult[0]?.canonical_store ?? rawStoreName;

		const storeRow = await sql`
			SELECT id FROM store_dimension WHERE store_name = ${canonicalStore} LIMIT 1
		`;
		const storeId = storeRow[0]?.id ?? null;

		// 3. Process Lines: Use lines array if present, otherwise create a summary order line
		let linesToProcess: any[] = [];
		if (Array.isArray(body.lines) && body.lines.length > 0) {
			linesToProcess = body.lines;
		} else {
			// Single summary order line from amount_total / amount_tax
			const amountTotal = Number(body.amount_total ?? body.net_amount ?? 0);
			const amountTax = Number(body.amount_tax ?? body.tax_amount ?? 0);
			const grossAmount = amountTotal - amountTax;

			linesToProcess = [
				{
					product_key: `PROD-${body.id || body._id || "GENERAL"}`,
					sku_code: `SKU-${order_name}`,
					item_name: `POS Order ${order_name}`,
					category: "POS General",
					brand: "POS",
					quantity: 1,
					mrp_amount: amountTotal,
					discount_amount: 0,
					gross_amount: grossAmount,
					tax_amount: amountTax,
					net_amount: amountTotal,
				},
			];
		}

		// 3.5 Ensure upload batch row exists in upload_batches
		await sql`
			INSERT INTO upload_batches (id, filename, status, row_count, valid_row_count, date_range_start, date_range_end, uploaded_at)
			VALUES (9999, 'Odoo Enterprise SaaS Pipeline', 'completed', 0, 0, '2025-01-01', NOW()::date, NOW())
			ON CONFLICT (id) DO NOTHING
		`;

		// 4. Atomic Upsert into sales_fact
		let upserted = 0;
		for (const line of linesToProcess) {
			const product_key = line.product_key || `PROD-${order_name}`;
			const item_name = line.item_name || `POS Item (${order_name})`;
			const quantity = Number(line.quantity ?? 1);
			const mrp_amount = Number(line.mrp_amount ?? line.price_unit ?? 0);
			const discount_amount = Number(line.discount_amount ?? 0);
			const gross_amount = Number(line.gross_amount ?? mrp_amount - discount_amount);
			const tax_amount = Number(line.tax_amount ?? 0);
			const net_amount = Number(line.net_amount ?? gross_amount + tax_amount);

			await sql`
				INSERT INTO sales_fact (
					upload_id, sale_date, bill_no, billed_by, product_key,
					category, brand, sku_code, item_name, quantity,
					mrp_amount, discount_amount, gross_amount, tax_amount, net_amount,
					payment_method, customer_mobile, customer_name, source_billed_by, store_id
				) VALUES (
					9999, ${sale_date}::date, ${order_name}, ${canonicalStore}, ${product_key},
					${line.category ?? "General"}, ${line.brand ?? "Odoo"}, ${line.sku_code ?? null}, ${item_name}, ${quantity},
					${mrp_amount}, ${discount_amount}, ${gross_amount}, ${tax_amount}, ${net_amount},
					${payment_method}, ${customer_mobile}, ${customer_name}, ${rawStoreName}, ${storeId}
				)
				ON CONFLICT (sale_date, bill_no, billed_by, product_key) DO UPDATE SET
					category = EXCLUDED.category,
					brand = EXCLUDED.brand,
					sku_code = EXCLUDED.sku_code,
					item_name = EXCLUDED.item_name,
					quantity = EXCLUDED.quantity,
					mrp_amount = EXCLUDED.mrp_amount,
					discount_amount = EXCLUDED.discount_amount,
					gross_amount = EXCLUDED.gross_amount,
					tax_amount = EXCLUDED.tax_amount,
					net_amount = EXCLUDED.net_amount,
					payment_method = EXCLUDED.payment_method,
					customer_mobile = EXCLUDED.customer_mobile,
					customer_name = EXCLUDED.customer_name
			`;
			upserted++;
		}

		return NextResponse.json({
			success: true,
			upserted,
			order: order_name,
			store: canonicalStore,
			date: sale_date,
		});
	} catch (error) {
		console.error("[webhook/odoo] Ingestion Error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal database error" },
			{ status: 500 }
		);
	}
}

export async function GET() {
	return NextResponse.json({
		status: "active",
		endpoint: "/api/webhooks/odoo",
		service: "ZenZebra Odoo Ingestion Receiver",
	});
}
