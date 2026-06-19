import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/sales/imports/preflight?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Checks whether sales_fact already has rows for the given date range.
 * Used by the upload page to warn users before committing a file that
 * would overwrite (now: upsert) existing data.
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = req.nextUrl;
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");

		if (!startDate || !endDate) {
			return NextResponse.json(
				{ success: false, error: "startDate and endDate are required" },
				{ status: 400 },
			);
		}

		const result = await sql`
      SELECT
        COUNT(*)::integer           AS existing_row_count,
        MIN(sale_date)::text        AS existing_start,
        MAX(sale_date)::text        AS existing_end
      FROM sales_fact
      WHERE sale_date >= ${startDate}::date
        AND sale_date <= ${endDate}::date
    `;

		const row = result[0] ?? {};
		const existingRowCount = Number(row.existing_row_count ?? 0);

		return NextResponse.json({
			success: true,
			data: {
				hasExistingData: existingRowCount > 0,
				existingRowCount,
				existingDateRange:
					existingRowCount > 0
						? {
								start: String(row.existing_start),
								end: String(row.existing_end),
							}
						: null,
				requestedRange: { start: startDate, end: endDate },
			},
		});
	} catch (error) {
		console.error("Preflight check failed:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Preflight check failed",
			},
			{ status: 500 },
		);
	}
}
