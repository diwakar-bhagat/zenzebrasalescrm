import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/net-purchase/trends
 *
 * Returns net purchase amounts grouped by month for trend charts.
 * Queries only `net_purchase_fact_v`.
 */
export async function GET(req: NextRequest) {
	try {
		const params = req.nextUrl.searchParams;
		const startDate = params.get("startDate");
		const endDate = params.get("endDate");
		const store = params.get("store") || null;
		const brand = params.get("brand") || null;
		const category = params.get("category") || null;
		const groupBy = params.get("groupBy") || "month"; // "day" | "month"

		let trendData: Array<Record<string, unknown>>;

		if (groupBy === "day") {
			trendData = await sql`
        SELECT
          purchase_date::text AS period,
          COALESCE(SUM(net_purchase_amount), 0)::numeric AS net_purchase,
          COALESCE(SUM(gross_purchase_amount), 0)::numeric AS gross_purchase,
          COALESCE(SUM(tax_amount), 0)::numeric AS tax,
          COUNT(*)::int AS row_count
        FROM net_purchase_fact_v
        WHERE (${startDate}::date IS NULL OR purchase_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR purchase_date <= ${endDate}::date)
          AND (${store}::text IS NULL OR store_display_name = ${store})
          AND (${brand}::text IS NULL OR brand = ${brand})
          AND (${category}::text IS NULL OR category = ${category})
        GROUP BY purchase_date
        ORDER BY purchase_date ASC
      `;
		} else {
			trendData = await sql`
        SELECT
          TO_CHAR(purchase_date, 'YYYY-MM') AS period,
          COALESCE(SUM(net_purchase_amount), 0)::numeric AS net_purchase,
          COALESCE(SUM(gross_purchase_amount), 0)::numeric AS gross_purchase,
          COALESCE(SUM(tax_amount), 0)::numeric AS tax,
          COUNT(*)::int AS row_count
        FROM net_purchase_fact_v
        WHERE (${startDate}::date IS NULL OR purchase_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR purchase_date <= ${endDate}::date)
          AND (${store}::text IS NULL OR store_display_name = ${store})
          AND (${brand}::text IS NULL OR brand = ${brand})
          AND (${category}::text IS NULL OR category = ${category})
        GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
        ORDER BY period ASC
      `;
		}

		return NextResponse.json({
			success: true,
			data: trendData.map((row) => ({
				period: row.period,
				netPurchase: Number(row.net_purchase),
				grossPurchase: Number(row.gross_purchase),
				tax: Number(row.tax),
				rowCount: Number(row.row_count),
			})),
		});
	} catch (error) {
		console.error("GET /api/net-purchase/trends failed:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch net purchase trends" },
			{ status: 500 },
		);
	}
}
