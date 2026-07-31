import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { OdooClient } from "../lib/odoo-client";
import { sql } from "../lib/db";

/**
 * ZenZebra Odoo Ingestion Pipeline: Historical Backfill & Delta Sync
 *
 * Pipeline 1: Historical Backfill (One-time or manual CLI invocation)
 *   Imports all historical pos.order and sale.order records from Odoo SaaS into Neon Postgres sales_fact.
 *
 * Pipeline 2: Delta Sync & Reconciliation (Cron / Periodic Sync)
 *   Queries Odoo using `write_date >= last_sync` to catch any missed updates, retries, or outages.
 */

let cachedOdooBatchId: number | null = null;

async function ensureOdooUploadBatch(): Promise<number> {
	if (cachedOdooBatchId) return cachedOdooBatchId;

	const existing = await sql`
		SELECT id FROM upload_batches WHERE filename = 'Odoo Enterprise SaaS Pipeline' LIMIT 1
	`;
	if (existing[0]?.id) {
		cachedOdooBatchId = Number(existing[0].id);
		return cachedOdooBatchId;
	}

	const row = await sql`
		INSERT INTO upload_batches (filename, status, row_count, valid_row_count, date_range_start, date_range_end, uploaded_at)
		VALUES ('Odoo Enterprise SaaS Pipeline', 'completed', 0, 0, '2025-01-01'::date, NOW()::date, NOW())
		RETURNING id
	`;
	cachedOdooBatchId = Number(row[0].id);
	return cachedOdooBatchId;
}

async function ensureSyncCursorTable() {
	await ensureOdooUploadBatch();
	await sql`
		CREATE TABLE IF NOT EXISTS sync_cursors (
			service_name VARCHAR(100) PRIMARY KEY,
			last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			records_synced INTEGER NOT NULL DEFAULT 0,
			status VARCHAR(50) NOT NULL DEFAULT 'success'
		)
	`;
}

async function getLastSyncTimestamp(serviceName = "odoo_pos_sync"): Promise<string | null> {
	await ensureSyncCursorTable();
	const rows = await sql`
		SELECT last_sync_at::text FROM sync_cursors WHERE service_name = ${serviceName} LIMIT 1
	`;
	return rows[0]?.last_sync_at ?? null;
}

async function updateSyncCursor(recordsSynced: number, serviceName = "odoo_pos_sync") {
	await ensureSyncCursorTable();
	await sql`
		INSERT INTO sync_cursors (service_name, last_sync_at, records_synced, status)
		VALUES (${serviceName}, NOW(), ${recordsSynced}, 'success')
		ON CONFLICT (service_name) DO UPDATE SET
			last_sync_at = EXCLUDED.last_sync_at,
			records_synced = EXCLUDED.records_synced,
			status = 'success'
	`;
}

function extractRelationName(val: any, fallback: string): string {
	if (Array.isArray(val) && val.length > 1 && typeof val[1] === "string") {
		return val[1];
	}
	if (typeof val === "string" && val.trim().length > 0) {
		return val;
	}
	return fallback;
}

export async function runOdooSync(options: { mode?: "backfill" | "delta"; batchSize?: number } = {}) {
	const mode = options.mode || "delta";
	const batchSize = options.batchSize || 200;

	console.log(`\n🚀 Starting ZenZebra Odoo Ingestion Pipeline [Mode: ${mode.toUpperCase()}]...`);

	const batchId = await ensureOdooUploadBatch();

	const client = new OdooClient();
	const uid = await client.authenticate();
	console.log(`✅ Authenticated with Odoo SaaS (User ID: ${uid})`);

	// Determine domain filter
	const domain: any[] = [["state", "in", ["paid", "done", "invoiced"]]];

	let lastSync: string | null = null;
	if (mode === "delta") {
		lastSync = await getLastSyncTimestamp();
		if (lastSync) {
			// Convert ISO to Odoo timestamp format 'YYYY-MM-DD HH:MM:SS'
			const odooFormattedDate = lastSync.replace("T", " ").split(".")[0];
			domain.push(["write_date", ">=", odooFormattedDate]);
			console.log(`🔍 Delta Sync Filter: write_date >= '${odooFormattedDate}'`);
		} else {
			console.log("ℹ️ No previous sync cursor found. Performing full initial scan...");
		}
	}

	// Fetch matching POS Orders count
	const totalCount = await client.searchCount("pos.order", domain);
	console.log(`📦 Total Odoo POS Orders to process: ${totalCount}`);

	if (totalCount === 0) {
		console.log("✅ Database is up to date. Zero new POS orders found.");
		await updateSyncCursor(0);
		return { success: true, processed: 0 };
	}

	let offset = 0;
	let totalUpserted = 0;

	while (offset < totalCount) {
		console.log(`\n⏳ Fetching batch ${offset + 1} to ${Math.min(offset + batchSize, totalCount)}...`);

		const orders = await client.searchRead(
			"pos.order",
			domain,
			[
				"id",
				"name",
				"date_order",
				"amount_total",
				"amount_tax",
				"state",
				"config_id",
				"partner_id",
				"lines",
				"write_date",
			],
			{ limit: batchSize, offset, order: "date_order asc" }
		);

		if (orders.length === 0) break;

		// Collect all line IDs across orders to batch fetch line item details
		const allLineIds: number[] = [];
		for (const order of orders) {
			if (Array.isArray(order.lines)) {
				allLineIds.push(...order.lines);
			}
		}

		let linesMap: Map<number, any> = new Map();
		if (allLineIds.length > 0) {
			// Chunk line IDs in batches of 500 to prevent query limits
			const lineChunks: number[][] = [];
			for (let i = 0; i < allLineIds.length; i += 500) {
				lineChunks.push(allLineIds.slice(i, i + 500));
			}

			for (const chunk of lineChunks) {
				const lineDetails = await client.searchRead(
					"pos.order.line",
					[["id", "in", chunk]],
					[
						"id",
						"order_id",
						"product_id",
						"qty",
						"price_unit",
						"price_subtotal",
						"price_subtotal_incl",
						"discount",
					]
				);
				for (const line of lineDetails) {
					linesMap.set(line.id, line);
				}
			}
		}

		// Process each order
		for (const order of orders) {
			const order_name = order.name || `POS-${order.id}`;
			const rawDate = order.date_order || new Date().toISOString();
			const sale_date = rawDate.split(" ")[0].split("T")[0];

			const rawStoreName = extractRelationName(order.config_id, "SmartworksNoida Noida");
			const customer_name = extractRelationName(order.partner_id, "Walk-in Customer");

			// Normalize Store Name
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

			// Extract lines
			const orderLineIds: number[] = Array.isArray(order.lines) ? order.lines : [];
			const lineRecords = orderLineIds.map((id) => linesMap.get(id)).filter(Boolean);

			if (lineRecords.length > 0) {
				for (const line of lineRecords) {
					const productName = extractRelationName(line.product_id, `Item-${line.id}`);
					const productId = Array.isArray(line.product_id) ? line.product_id[0] : line.id;
					const product_key = `PROD-${productId}`;
					const quantity = Number(line.qty ?? 1);
					const priceUnit = Number(line.price_unit ?? 0);
					const mrp_amount = priceUnit * quantity;
					const discount_amount = Number(line.discount ?? 0);
					const net_amount = Number(line.price_subtotal_incl ?? line.price_subtotal ?? mrp_amount);
					const gross_amount = Number(line.price_subtotal ?? net_amount);
					const tax_amount = net_amount - gross_amount;

					await sql`
						INSERT INTO sales_fact (
							upload_id, sale_date, bill_no, billed_by, product_key,
							category, brand, sku_code, item_name, quantity,
							mrp_amount, discount_amount, gross_amount, tax_amount, net_amount,
							payment_method, customer_name, source_billed_by, store_id
						) VALUES (
							${batchId}, ${sale_date}::date, ${order_name}, ${canonicalStore}, ${product_key},
							'POS General', 'Odoo POS', ${`SKU-${productId}`}, ${productName}, ${quantity},
							${mrp_amount}, ${discount_amount}, ${gross_amount}, ${tax_amount}, ${net_amount},
							'POS Cash/Card', ${customer_name}, ${rawStoreName}, ${storeId}
						)
						ON CONFLICT (sale_date, bill_no, billed_by, product_key) DO UPDATE SET
							quantity = EXCLUDED.quantity,
							mrp_amount = EXCLUDED.mrp_amount,
							discount_amount = EXCLUDED.discount_amount,
							gross_amount = EXCLUDED.gross_amount,
							tax_amount = EXCLUDED.tax_amount,
							net_amount = EXCLUDED.net_amount,
							customer_name = EXCLUDED.customer_name
					`;
					totalUpserted++;
				}
			} else {
				// Summary record if line details unavailable
				const amountTotal = Number(order.amount_total ?? 0);
				const amountTax = Number(order.amount_tax ?? 0);
				const grossAmount = amountTotal - amountTax;

				await sql`
					INSERT INTO sales_fact (
						upload_id, sale_date, bill_no, billed_by, product_key,
						category, brand, sku_code, item_name, quantity,
						mrp_amount, discount_amount, gross_amount, tax_amount, net_amount,
						payment_method, customer_name, source_billed_by, store_id
					) VALUES (
						${batchId}, ${sale_date}::date, ${order_name}, ${canonicalStore}, ${`PROD-SUMMARY-${order.id}`},
						'POS Summary', 'Odoo POS', ${`SKU-${order.id}`}, ${`POS Order ${order_name}`}, 1,
						${amountTotal}, 0, ${grossAmount}, ${amountTax}, ${amountTotal},
						'POS Cash/Card', ${customer_name}, ${rawStoreName}, ${storeId}
					)
					ON CONFLICT (sale_date, bill_no, billed_by, product_key) DO UPDATE SET
						net_amount = EXCLUDED.net_amount,
						gross_amount = EXCLUDED.gross_amount,
						tax_amount = EXCLUDED.tax_amount
				`;
				totalUpserted++;
			}
		}

		offset += batchSize;
		console.log(`  └─ Progress: ${Math.min(offset, totalCount)} / ${totalCount} orders synced.`);
	}

	await updateSyncCursor(totalUpserted);
	console.log(`\n🎉 Sync Completed Successfully! Total line items upserted into Neon DB: ${totalUpserted}\n`);
	return { success: true, processed: totalUpserted };
}

// Enable direct CLI invocation
if (require.main === module) {
	const args = process.argv.slice(2);
	const mode = args.includes("--backfill") ? "backfill" : "delta";
	runOdooSync({ mode })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("❌ Sync Error:", err);
			process.exit(1);
		});
}
