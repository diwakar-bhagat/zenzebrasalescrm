import { sql } from "@/lib/db";
import type { CanonicalSaleLine, SourceSystem } from "./types";

/**
 * The single writer into sales_fact for ERP-sourced data.
 *
 * Upserts on the existing uq_sales_fact_key (sale_date, bill_no, billed_by, product_key)
 * constraint and always stamps provenance (source_system / ingested_at / source_event_at) so
 * sync health can be computed from the facts themselves rather than inferred from batch names.
 */

const ODOO_BATCH_FILENAME = "Odoo Enterprise SaaS Pipeline";

let cachedBatchId: number | null = null;

/**
 * sales_fact.upload_id is a FK to upload_batches, so ERP rows still need a batch to hang off.
 * Resolve the shared Odoo batch by filename rather than hardcoding an id — the webhook route
 * used to pin 9999 and the /sales route used 0, which matched no batch at all.
 */
export async function resolveOdooBatchId(): Promise<number> {
	if (cachedBatchId !== null) return cachedBatchId;

	const existing = await sql`
		SELECT id FROM upload_batches WHERE filename = ${ODOO_BATCH_FILENAME} ORDER BY id LIMIT 1
	`;
	if (existing[0]?.id !== undefined) {
		cachedBatchId = Number(existing[0].id);
		return cachedBatchId;
	}

	const created = await sql`
		INSERT INTO upload_batches (filename, status, row_count, valid_row_count, date_range_start, date_range_end, uploaded_at)
		VALUES (${ODOO_BATCH_FILENAME}, 'success', 0, 0, '2025-01-01'::date, NOW()::date, NOW())
		RETURNING id
	`;
	cachedBatchId = Number(created[0].id);
	return cachedBatchId;
}

/** Neon's HTTP driver caps parameters per statement; keep batches well inside that. */
const CHUNK_SIZE = 200;

export interface IngestResult {
	upserted: number;
	unresolvedStores: string[];
}

/**
 * Upserts canonical rows into sales_fact.
 *
 * Rows are written in chunks with UNNEST — the same technique the Excel commit path uses —
 * rather than one round-trip per line, which is what made the old sync O(lines) HTTP calls.
 */
export async function ingestSalesLines(
	rows: CanonicalSaleLine[],
	sourceSystem: SourceSystem,
): Promise<IngestResult> {
	if (rows.length === 0) return { upserted: 0, unresolvedStores: [] };

	const batchId = await resolveOdooBatchId();
	const unresolvedStores = new Set<string>();
	let upserted = 0;

	for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
		const chunk = rows.slice(i, i + CHUNK_SIZE);

		for (const row of chunk) {
			if (row.store_id === null) unresolvedStores.add(row.source_billed_by);
		}

		await sql`
			INSERT INTO sales_fact (
				upload_id, sale_date, bill_no, billed_by, product_key,
				category, brand, sku_code, item_name, quantity,
				mrp_amount, discount_amount, gross_amount, tax_amount, net_amount,
				payment_method, customer_mobile, customer_name, source_billed_by, store_id,
				source_system, ingested_at, source_event_at
			)
			SELECT * FROM UNNEST (
				${chunk.map(() => batchId)}::integer[],
				${chunk.map((r) => r.sale_date)}::date[],
				${chunk.map((r) => r.bill_no)}::text[],
				${chunk.map((r) => r.billed_by)}::text[],
				${chunk.map((r) => r.product_key)}::text[],
				${chunk.map((r) => r.category)}::text[],
				${chunk.map((r) => r.brand)}::text[],
				${chunk.map((r) => r.sku_code)}::text[],
				${chunk.map((r) => r.item_name)}::text[],
				${chunk.map((r) => Math.round(r.quantity))}::integer[],
				${chunk.map((r) => r.mrp_amount)}::numeric[],
				${chunk.map((r) => r.discount_amount)}::numeric[],
				${chunk.map((r) => r.gross_amount)}::numeric[],
				${chunk.map((r) => r.tax_amount)}::numeric[],
				${chunk.map((r) => r.net_amount)}::numeric[],
				${chunk.map((r) => r.payment_method)}::text[],
				${chunk.map((r) => r.customer_mobile)}::text[],
				${chunk.map((r) => r.customer_name)}::text[],
				${chunk.map((r) => r.source_billed_by)}::text[],
				${chunk.map((r) => r.store_id)}::integer[],
				${chunk.map(() => sourceSystem)}::text[],
				${chunk.map(() => new Date().toISOString())}::timestamptz[],
				${chunk.map((r) => r.source_event_at)}::timestamptz[]
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
				customer_mobile = COALESCE(EXCLUDED.customer_mobile, sales_fact.customer_mobile),
				customer_name = EXCLUDED.customer_name,
				store_id = COALESCE(EXCLUDED.store_id, sales_fact.store_id),
				source_system = EXCLUDED.source_system,
				ingested_at = EXCLUDED.ingested_at,
				source_event_at = EXCLUDED.source_event_at
		`;

		upserted += chunk.length;
	}

	return { upserted, unresolvedStores: [...unresolvedStores] };
}
