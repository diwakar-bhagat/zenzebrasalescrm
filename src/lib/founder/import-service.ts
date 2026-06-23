import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  parseExcelBuffer,
  parseResultToValidation,
} from "@/lib/parser/excel-parser";
import type { ParsedSalesRow, ValidationResult } from "./types";

type FounderSql = NeonQueryFunction<false, false>;
type UploadType = "full_replace" | "incremental";

const INSERT_CHUNK_SIZE = 1000;

function chunkRows(rows: ParsedSalesRow[]) {
  const chunks: ParsedSalesRow[][] = [];
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    chunks.push(rows.slice(index, index + INSERT_CHUNK_SIZE));
  }
  return chunks;
}

export async function validateFounderUploadFile(file: File): Promise<ValidationResult> {
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const parseResult = parseExcelBuffer(buffer);
    return parseResultToValidation(parseResult);
  } catch (error) {
    return {
      isValid: false,
      totalRows: 0,
      validRows: 0,
      errorCount: 1,
      errors: [
        {
          rowNumber: 0,
          errors: [error instanceof Error ? error.message : "Failed to parse Excel file"],
        },
      ],
      validData: [],
      dateRange: { start: null, end: null },
    };
  }
}

export async function commitFounderUploadFile(
  db: FounderSql,
  file: File,
  uploadType: UploadType = "full_replace",
) {
  const validation = await validateFounderUploadFile(file);

  if (!validation.isValid || validation.validData.length === 0) {
    return {
      success: false,
      validation,
      error: "No valid rows found. Cannot commit upload.",
    };
  }

  const batchIdResult = await db`
    SELECT nextval(pg_get_serial_sequence('upload_batches', 'id'))::integer AS id
  `;
  const batchId = Number(batchIdResult[0]?.id);

  if (!Number.isFinite(batchId)) {
    throw new Error("Unable to allocate upload batch id.");
  }

  const chunks = chunkRows(validation.validData);
  const latestSaleDate = validation.latestSaleDate ?? validation.dateRange.end;

  await db.transaction?.((tx) => {
    const queries = [
      tx`
        INSERT INTO upload_batches (
          id,
          filename,
          status,
          row_count,
          error_count,
          valid_row_count,
          quarantined_row_count,
          date_range_start,
          date_range_end,
          upload_type,
          latest_sale_date,
          row_count_raw,
          row_count_stored,
          rows_quarantined
        )
        VALUES (
          ${batchId},
          ${file.name},
          'success',
          ${validation.totalRows},
          ${validation.errorCount},
          ${validation.validRows},
          ${validation.errorCount},
          ${validation.dateRange.start},
          ${validation.dateRange.end},
          ${uploadType},
          ${latestSaleDate},
          ${validation.totalRows},
          ${validation.validRows},
          ${validation.errorCount}
        )
      `,
    ];

    for (const [index, row] of validation.validData.entries()) {
      queries.push(tx`
        INSERT INTO staging_upload_rows (batch_id, row_number, parsed, status, error_reason)
        VALUES (
          ${batchId},
          ${index + 1},
          ${JSON.stringify(row)}::jsonb,
          'valid',
          NULL
        )
      `);
    }

    if (uploadType === "full_replace") {
      queries.push(tx`TRUNCATE sales_fact`);
    } else if (latestSaleDate) {
      queries.push(tx`
        DELETE FROM sales_fact
        WHERE sale_date = ${latestSaleDate}::date
      `);
    }

    for (const chunk of chunks) {
      queries.push(tx`
        INSERT INTO sales_fact (
          upload_id,
          sale_date,
          bill_no,
          billed_by,
          category,
          brand,
          sku_code,
          item_name,
          quantity,
          net_amount,
          discount_amount,
          payment_method,
          customer_mobile,
          customer_name
        )
        SELECT * FROM UNNEST (
          ${chunk.map(() => batchId)}::integer[],
          ${chunk.map((row) => row.sale_date)}::date[],
          ${chunk.map((row) => row.bill_no)}::text[],
          ${chunk.map((row) => row.billed_by)}::text[],
          ${chunk.map((row) => row.category)}::text[],
          ${chunk.map((row) => row.brand)}::text[],
          ${chunk.map((row) => row.sku_code)}::text[],
          ${chunk.map((row) => row.item_name)}::text[],
          ${chunk.map((row) => row.quantity)}::integer[],
          ${chunk.map((row) => row.net_amount)}::numeric[],
          ${chunk.map((row) => row.discount_amount)}::numeric[],
          ${chunk.map((row) => row.payment_method)}::text[],
          ${chunk.map((row) => row.customer_mobile)}::text[],
          ${chunk.map((row) => row.customer_name)}::text[]
        )
        ON CONFLICT ON CONSTRAINT uq_sales_fact_key DO UPDATE SET
          upload_id = EXCLUDED.upload_id,
          category = EXCLUDED.category,
          brand = EXCLUDED.brand,
          item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity,
          net_amount = EXCLUDED.net_amount,
          discount_amount = EXCLUDED.discount_amount,
          payment_method = EXCLUDED.payment_method,
          customer_mobile = EXCLUDED.customer_mobile,
          customer_name = EXCLUDED.customer_name
      `);
    }

    queries.push(tx`
      DELETE FROM staging_upload_rows
      WHERE batch_id = ${batchId}
    `);

    return queries;
  });

  return {
    success: true,
    batchId,
    rowsInserted: validation.validRows,
    validation,
  };
}
