import * as xlsx from "xlsx";

import { validateCanonicalSheet } from "./validation";
import type { CanonicalSalesRow, ValidationResult } from "./types";

type FounderSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  transaction?: (
    queriesOrFn: (sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown) => unknown[],
  ) => Promise<Record<string, unknown>[][]>;
};

const INSERT_CHUNK_SIZE = 1000;

export async function validateFounderUploadFile(file: File): Promise<ValidationResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      isValid: false,
      totalRows: 0,
      validRows: 0,
      errorCount: 1,
      errors: [{ rowNumber: 0, errors: ["Workbook does not contain any sheets."] }],
      validData: [],
      dateRange: { start: null, end: null },
      parsedData: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  return validateCanonicalSheet(rows);
}

function chunkRows(rows: CanonicalSalesRow[]) {
  const chunks: CanonicalSalesRow[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + INSERT_CHUNK_SIZE));
  }
  return chunks;
}

export async function commitFounderUploadFile(db: FounderSql, file: File) {
  const validation = await validateFounderUploadFile(file);

  if (!validation.isValid || !validation.dateRange.start || !validation.dateRange.end) {
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
          date_range_end
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
          ${validation.dateRange.end}
        )
      `,
      tx`
        DELETE FROM sales_fact
        WHERE sale_date >= ${validation.dateRange.start}::date
          AND sale_date <= ${validation.dateRange.end}::date
      `,
    ];

    for (const chunk of chunks) {
      queries.push(tx`
        INSERT INTO sales_fact (
          batch_id,
          sale_date,
          bill_no,
          store,
          category,
          brand,
          sku,
          product_name,
          quantity,
          net_amount,
          customer_id,
          row_number
        )
        SELECT * FROM UNNEST (
          ${chunk.map(() => batchId)}::integer[],
          ${chunk.map((row) => row.sale_date)}::date[],
          ${chunk.map((row) => row.bill_no)}::text[],
          ${chunk.map((row) => row.store)}::text[],
          ${chunk.map((row) => row.category)}::text[],
          ${chunk.map((row) => row.brand)}::text[],
          ${chunk.map((row) => row.sku)}::text[],
          ${chunk.map((row) => row.product_name)}::text[],
          ${chunk.map((row) => row.quantity)}::integer[],
          ${chunk.map((row) => row.net_amount)}::numeric[],
          ${chunk.map((row) => row.customer_id)}::text[],
          ${chunk.map((row) => row.row_number)}::integer[]
        )
      `);
    }

    return queries;
  });

  return {
    success: true,
    batchId,
    rowsInserted: validation.validRows,
    validation,
  };
}
