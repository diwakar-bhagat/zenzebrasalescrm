import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
	type ParsedPurchaseRow,
	parsePurchaseExcelBuffer,
} from "@/lib/parser/purchase-parser";
import { createStoreNormalizer } from "@/lib/parser/store-normalizer";

type FounderSql = NeonQueryFunction<false, false>;
type UploadType = "full_replace" | "incremental";

const INSERT_CHUNK_SIZE = 1000;

export interface PurchaseImportResult {
	success: boolean;
	error?: string;
	batchId?: number;
	rowsInserted?: number;
	quarantined?: number;
	quarantineReasons?: string[];
	dateRange?: { start: string | null; end: string | null };
	netPurchase?: number;
	normalizationReport?: Record<
		string,
		{ displayName: string; totalRows: number }
	>;
}

function chunkRows(rows: ParsedPurchaseRow[]) {
	const chunks: ParsedPurchaseRow[][] = [];
	for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
		chunks.push(rows.slice(index, index + INSERT_CHUNK_SIZE));
	}
	return chunks;
}

/**
 * Parse + normalize a purchase workbook and commit into `purchase_fact`.
 *
 * Store normalization reuses the SAME normalizer as sales, so head-office /
 * employee billed_by values (Surjeet Kumar, Master Admin, AwfisGgn Ggn, ...)
 * continue collapsing into SmartworksNoida Noida. Head office is never surfaced.
 */
export async function commitPurchaseUploadFile(
	db: FounderSql,
	file: File,
	uploadType: UploadType = "full_replace",
): Promise<PurchaseImportResult> {
	const buffer = Buffer.from(await file.arrayBuffer());

	let parsed: ReturnType<typeof parsePurchaseExcelBuffer>;
	try {
		parsed = parsePurchaseExcelBuffer(buffer);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to parse purchase file",
		};
	}

	if (parsed.rows.length === 0) {
		return {
			success: false,
			error: "No valid purchase rows found. Cannot commit upload.",
			quarantined: parsed.quarantined,
			quarantineReasons: parsed.quarantine_reasons,
		};
	}

	const normalizer = await createStoreNormalizer(db);
	const normalizationReport: Record<
		string,
		{ displayName: string; totalRows: number }
	> = {};

	const mappedRows: ParsedPurchaseRow[] = parsed.rows.map((row) => {
		const rawBilled = row.billed_by;
		const mapping = normalizer.normalize(rawBilled);
		if (!normalizationReport[mapping.canonicalStore]) {
			normalizationReport[mapping.canonicalStore] = {
				displayName: mapping.displayName,
				totalRows: 0,
			};
		}
		normalizationReport[mapping.canonicalStore]!.totalRows += 1;
		return {
			...row,
			source_billed_by: rawBilled,
			billed_by: mapping.canonicalStore,
			store_id: mapping.storeId,
		};
	});

	const dates = mappedRows.map((r) => r.purchase_date).sort();
	const dateRange = { start: dates[0] ?? null, end: dates.at(-1) ?? null };
	const netPurchase = mappedRows.reduce(
		(sum, r) => sum + (r.net_purchase_amount || 0),
		0,
	);

	const batchIdResult = await db`
    SELECT nextval(pg_get_serial_sequence('purchase_batches', 'id'))::integer AS id
  `;
	const batchId = Number(batchIdResult[0]?.id);
	if (!Number.isFinite(batchId)) {
		throw new Error("Unable to allocate purchase batch id.");
	}

	const chunks = chunkRows(mappedRows);

	await db.transaction?.((tx) => {
		const queries = [
			tx`
        INSERT INTO purchase_batches (
          id, filename, status, row_count, valid_row_count, quarantined_row_count,
          date_range_start, date_range_end, upload_type, net_purchase
        ) VALUES (
          ${batchId}, ${file.name}, 'success', ${parsed.raw_row_count},
          ${mappedRows.length}, ${parsed.quarantined},
          ${dateRange.start}, ${dateRange.end}, ${uploadType}, ${netPurchase}::numeric
        )
      `,
		];

		if (uploadType === "full_replace") {
			queries.push(tx`DELETE FROM purchase_fact`);
		}

		for (const chunk of chunks) {
			queries.push(tx`
        INSERT INTO purchase_fact (
          upload_id, purchase_date, bill_no, billed_by, product_key, sku_code,
          item_name, brand, category, quantity, gross_purchase_amount, tax_amount,
          net_purchase_amount, supplier_name, source_billed_by, store_id
        )
        SELECT * FROM UNNEST (
          ${chunk.map(() => batchId)}::integer[],
          ${chunk.map((r) => r.purchase_date)}::date[],
          ${chunk.map((r) => r.bill_no)}::text[],
          ${chunk.map((r) => r.billed_by)}::text[],
          ${chunk.map((r) => r.product_key)}::text[],
          ${chunk.map((r) => r.sku_code)}::text[],
          ${chunk.map((r) => r.item_name)}::text[],
          ${chunk.map((r) => r.brand)}::text[],
          ${chunk.map((r) => r.category)}::text[],
          ${chunk.map((r) => r.quantity)}::integer[],
          ${chunk.map((r) => r.gross_purchase_amount)}::numeric[],
          ${chunk.map((r) => r.tax_amount)}::numeric[],
          ${chunk.map((r) => r.net_purchase_amount)}::numeric[],
          ${chunk.map((r) => r.supplier_name)}::text[],
          ${chunk.map((r) => r.source_billed_by || r.billed_by)}::text[],
          ${chunk.map((r) => r.store_id || null)}::integer[]
        )
        ON CONFLICT (purchase_date, COALESCE(bill_no, ''), COALESCE(billed_by, ''), product_key)
        DO UPDATE SET
          upload_id = EXCLUDED.upload_id,
          sku_code = EXCLUDED.sku_code,
          item_name = EXCLUDED.item_name,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          quantity = EXCLUDED.quantity,
          gross_purchase_amount = EXCLUDED.gross_purchase_amount,
          tax_amount = EXCLUDED.tax_amount,
          net_purchase_amount = EXCLUDED.net_purchase_amount,
          supplier_name = EXCLUDED.supplier_name,
          source_billed_by = EXCLUDED.source_billed_by,
          store_id = EXCLUDED.store_id
      `);
		}

		return queries;
	});

	return {
		success: true,
		batchId,
		rowsInserted: mappedRows.length,
		quarantined: parsed.quarantined,
		quarantineReasons: parsed.quarantine_reasons,
		dateRange,
		netPurchase,
		normalizationReport,
	};
}
