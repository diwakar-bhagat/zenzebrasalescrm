import type { NeonQueryFunction } from "@neondatabase/serverless";

type FounderSql = NeonQueryFunction<false, false>;

import {
	type ParsedInventoryRow,
	parseInventoryRawRows,
} from "@/lib/parser/inventory-parser";

const INSERT_CHUNK_SIZE = 2000;

export interface InventoryImportResult {
	success: boolean;
	error?: string;
	batchId?: number;
	rowsInserted?: number;
	quarantined?: number;
	quarantineReasons?: string[];
	normalizationReport?: Record<
		string,
		{
			displayName: string;
			rawSourcesCount: Record<string, number>;
			totalRows: number;
		}
	>;
	_validatedRows?: ParsedInventoryRow[];
}

function chunkRows(rows: ParsedInventoryRow[]) {
	const chunks: ParsedInventoryRow[][] = [];
	for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
		chunks.push(rows.slice(index, index + INSERT_CHUNK_SIZE));
	}
	return chunks;
}

export async function startInventoryUploadBatch(
	db: FounderSql,
	filename: string,
): Promise<{ success: boolean; data: { batchId: number } }> {
	const result = await db`
		INSERT INTO inventory_batches (filename, status, row_count, valid_row_count, quarantined_row_count)
		VALUES (${filename}, 'processing', 0, 0, 0)
		RETURNING id
	`;
	const batchId = result[0]?.id;
	if (!batchId) {
		throw new Error("Failed to allocate batch ID for inventory upload.");
	}
	return { success: true, data: { batchId } };
}

export async function stageInventoryUploadChunk(
	db: FounderSql,
	batchId: number,
	chunkIndex: number,
	rawRows: Record<string, unknown>[],
): Promise<void> {
	if (rawRows.length === 0) return;

	const startIndex = chunkIndex * rawRows.length;
	const chunk = rawRows.map((row, i) => ({
		row_number: startIndex + i + 1,
		parsed: JSON.stringify(row),
		status: "valid",
	}));

	await db`
		INSERT INTO staging_inventory_rows (batch_id, row_number, parsed, status, error_reason)
		SELECT * FROM UNNEST (
			${chunk.map(() => batchId)}::integer[],
			${chunk.map((r) => r.row_number)}::integer[],
			${chunk.map((r) => r.parsed)}::jsonb[],
			${chunk.map((r) => r.status)}::text[],
			${chunk.map(() => null)}::text[]
		)
	`;
}

export async function validateStagedInventoryUpload(
	db: FounderSql,
	batchId: number,
): Promise<InventoryImportResult> {
	try {
		const stagedRows = await db`
			SELECT parsed FROM staging_inventory_rows
			WHERE batch_id = ${batchId}
			ORDER BY row_number ASC
		`;

		const rawRows = stagedRows.map((r) => r.parsed as Record<string, unknown>);
		const parsed = parseInventoryRawRows(rawRows);

		if (parsed.rows.length === 0) {
			return {
				success: false,
				error: "No valid inventory rows found. Cannot commit upload.",
				quarantined: parsed.quarantined,
				quarantineReasons: parsed.quarantine_reasons,
			};
		}

		let totalMainQty = 0;
		let totalSmartworksQty = 0;
		let totalKljQty = 0;

		for (const row of parsed.rows) {
			totalMainQty += row.main_stock;
			totalSmartworksQty += row.smartworks_stock;
			totalKljQty += row.klj_stock;
		}

		const normalizationReport: Record<
			string,
			{
				displayName: string;
				rawSourcesCount: Record<string, number>;
				totalRows: number;
			}
		> = {
			Main: {
				displayName: "Main Store Stock",
				rawSourcesCount: { Main: totalMainQty },
				totalRows: parsed.rows.length,
			},
			Smartworks: {
				displayName: "Smartworks Noida Stock",
				rawSourcesCount: { Smartworks: totalSmartworksQty },
				totalRows: parsed.rows.length,
			},
			KLJ: {
				displayName: "KLJ Tower Noida Stock",
				rawSourcesCount: { KLJ: totalKljQty },
				totalRows: parsed.rows.length,
			},
		};

		return {
			success: true,
			batchId,
			rowsInserted: parsed.rows.length,
			quarantined: parsed.quarantined,
			quarantineReasons: parsed.quarantine_reasons,
			normalizationReport,
			_validatedRows: parsed.rows,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to parse inventory staged rows",
		};
	}
}

export async function commitStagedInventoryUpload(
	db: FounderSql,
	batchId: number,
	uploadType = "full_replace",
) {
	const validation = await validateStagedInventoryUpload(db, batchId);

	if (
		!validation.success ||
		!validation._validatedRows ||
		validation.rowsInserted === 0
	) {
		return {
			success: false,
			error: validation.error || "No valid rows found. Cannot commit upload.",
			validation,
		};
	}

	// Deduplicate rows by product_key (sku_code) to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time" error
	const uniqueRowsMap = new Map<string, ParsedInventoryRow>();
	for (const row of validation._validatedRows) {
		uniqueRowsMap.set(row.product_key, row);
	}
	const mappedRows = Array.from(uniqueRowsMap.values());
	const chunks = chunkRows(mappedRows);
	const rowsInserted = mappedRows.length;
	const quarantined = validation.quarantined ?? 0;

	await db.transaction?.((tx) => {
		const queries = [
			tx`
				UPDATE inventory_batches
				SET
					status = 'success',
					row_count = ${rowsInserted + quarantined},
					valid_row_count = ${rowsInserted},
					quarantined_row_count = ${quarantined}
				WHERE id = ${batchId}
			`,
		];

		if (uploadType === "full_replace") {
			queries.push(
				tx`DELETE FROM inventory_snapshot WHERE snapshot_date = CURRENT_DATE`,
			);
		}

		for (const chunk of chunks) {
			// 1. Upsert product_master
			queries.push(tx`
				INSERT INTO product_master (
					product_key, sku_code, product_name, category, mrp, purchase_price, active, updated_at
				)
				SELECT * FROM UNNEST (
					${chunk.map((r) => r.product_key)}::text[],
					${chunk.map((r) => r.sku_code)}::text[],
					${chunk.map((r) => r.item_name)}::text[],
					${chunk.map((r) => r.category)}::text[],
					${chunk.map((r) => r.mrp)}::numeric[],
					${chunk.map((r) => r.purchase_price)}::numeric[],
					${chunk.map(() => true)}::boolean[],
					${chunk.map(() => new Date())}::timestamptz[]
				)
				ON CONFLICT (product_key) DO UPDATE SET
					sku_code = EXCLUDED.sku_code,
					product_name = EXCLUDED.product_name,
					category = EXCLUDED.category,
					mrp = EXCLUDED.mrp,
					purchase_price = EXCLUDED.purchase_price,
					updated_at = now()
			`);

			// 2. Insert inventory_snapshot
			queries.push(tx`
				INSERT INTO inventory_snapshot (
					batch_id, product_key, main_stock, smartworks_stock, klj_stock, snapshot_date
				)
				SELECT * FROM UNNEST (
					${chunk.map(() => batchId)}::integer[],
					${chunk.map((r) => r.product_key)}::text[],
					${chunk.map((r) => r.main_stock)}::integer[],
					${chunk.map((r) => r.smartworks_stock)}::integer[],
					${chunk.map((r) => r.klj_stock)}::integer[],
					${chunk.map(() => new Date())}::date[]
				)
				ON CONFLICT (product_key, snapshot_date) DO UPDATE SET
					batch_id = EXCLUDED.batch_id,
					main_stock = EXCLUDED.main_stock,
					smartworks_stock = EXCLUDED.smartworks_stock,
					klj_stock = EXCLUDED.klj_stock,
					created_at = now()
			`);
		}

		queries.push(tx`
			DELETE FROM staging_inventory_rows
			WHERE batch_id = ${batchId}
		`);

		return queries;
	});

	return {
		success: true,
		batchId,
		rowsInserted,
		validation,
	};
}
