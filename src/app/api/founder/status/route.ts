import { NextResponse } from "next/server";

import { sql } from "@/lib/db";

export const runtime = "nodejs";

function emptyStatus() {
  return {
    hasData: false,
    isSeeded: false,
    totalRows: 0,
    minDate: null,
    maxDate: null,
    totalRevenue: 0,
    latestBatch: null,
    availableStores: [],
    availableCategories: [],
    availableBrands: [],
  };
}

export async function GET() {
  try {
    const [statsResult, latestBatchResult, storesResult, categoriesResult, brandsResult] = await Promise.all([
      sql`
        SELECT
          COUNT(*) AS total_rows,
          MIN(sale_date) AS min_date,
          MAX(sale_date) AS max_date,
          COALESCE(SUM(net_amount), 0) AS total_revenue
        FROM sales_fact
      `,
      sql`
        SELECT
          id,
          filename,
          status,
          row_count AS "rowCount",
          error_count AS "errorCount",
          valid_row_count AS "validRowCount",
          quarantined_row_count AS "quarantinedRowCount",
          date_range_start AS "dateRangeStart",
          date_range_end AS "dateRangeEnd",
          uploaded_at AS "uploadedAt"
        FROM upload_batches
        ORDER BY uploaded_at DESC
        LIMIT 1
      `,
      sql`SELECT DISTINCT store FROM sales_fact WHERE store IS NOT NULL AND store <> '' ORDER BY store`,
      sql`SELECT DISTINCT category FROM sales_fact WHERE category IS NOT NULL AND category <> '' ORDER BY category`,
      sql`SELECT DISTINCT brand FROM sales_fact WHERE brand IS NOT NULL AND brand <> '' ORDER BY brand`,
    ]);

    const stats = statsResult[0] ?? {};
    const totalRows = Number(stats.total_rows ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        hasData: totalRows > 0,
        isSeeded: totalRows > 0,
        totalRows,
        minDate: stats.min_date ?? null,
        maxDate: stats.max_date ?? null,
        totalRevenue: Number(stats.total_revenue ?? 0),
        latestBatch: latestBatchResult[0] ?? null,
        availableStores: storesResult.map((row) => row.store).filter(Boolean),
        availableCategories: categoriesResult.map((row) => row.category).filter(Boolean),
        availableBrands: brandsResult.map((row) => row.brand).filter(Boolean),
      },
    });
  } catch (error: any) {
    if (error?.code === "42P01") {
      return NextResponse.json({ success: true, data: emptyStatus() });
    }

    console.error("Failed to fetch founder status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch database status",
        message: error?.message || String(error),
        code: error?.code,
        fullError: JSON.stringify(error),
      },
      { status: 500 },
    );
  }
}
