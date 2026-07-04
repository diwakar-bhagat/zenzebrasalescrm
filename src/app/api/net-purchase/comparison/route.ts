import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/net-purchase/comparison
 *
 * Side-by-side comparison of net purchase vs revenue vs estimated COGS.
 * Reads `net_purchase_fact_v` for purchase data and `sales_fact_v` for
 * revenue data. This is a READ-ONLY cross-reference — it never writes
 * to either table.
 */
export async function GET(req: NextRequest) {
	try {
		const params = req.nextUrl.searchParams;
		const startDate = params.get("startDate");
		const endDate = params.get("endDate");
		const store = params.get("store") || null;

		// Net Purchase totals
		const [purchaseRow] = await sql`
      SELECT
        COALESCE(SUM(net_purchase_amount), 0)::numeric AS total_net_purchase,
        COUNT(*)::int AS purchase_rows
      FROM net_purchase_fact_v
      WHERE (${startDate}::date IS NULL OR purchase_date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR purchase_date <= ${endDate}::date)
        AND (${store}::text IS NULL OR store_display_name = ${store})
    `;

		// Sales revenue totals (read-only cross-reference)
		let revenueRow: Record<string, unknown> = {
			total_revenue: 0,
			revenue_rows: 0,
		};
		try {
			const [row] = await sql`
        SELECT
          COALESCE(SUM(net_amount), 0)::numeric AS total_revenue,
          COUNT(*)::int AS revenue_rows
        FROM sales_fact_v
        WHERE (${startDate}::date IS NULL OR sale_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR sale_date <= ${endDate}::date)
          AND (${store}::text IS NULL OR store_display_name = ${store})
      `;
			if (row) revenueRow = row;
		} catch {
			// If sales_fact_v is unavailable, degrade gracefully.
		}

		// Estimated COGS from product_master (read-only cross-reference)
		let estimatedCogs = 0;
		try {
			const [cogsRow] = await sql`
        SELECT
          COALESCE(SUM(sf.quantity * pm.purchase_price), 0)::numeric AS estimated_cogs
        FROM sales_fact_v sf
        JOIN product_master pm ON sf.sku_code = pm.sku_code
        WHERE (${startDate}::date IS NULL OR sf.sale_date >= ${startDate}::date)
          AND (${endDate}::date IS NULL OR sf.sale_date <= ${endDate}::date)
          AND (${store}::text IS NULL OR sf.store_display_name = ${store})
      `;
			estimatedCogs = Number(cogsRow?.estimated_cogs ?? 0);
		} catch {
			// If product_master or sales_fact_v is unavailable, degrade gracefully.
		}

		const totalNetPurchase = Number(purchaseRow?.total_net_purchase ?? 0);
		const totalRevenue = Number(revenueRow?.total_revenue ?? 0);

		return NextResponse.json({
			success: true,
			data: {
				netPurchase: totalNetPurchase,
				revenue: totalRevenue,
				estimatedCogs,
				purchaseToRevenueRatio:
					totalRevenue > 0
						? Number(((totalNetPurchase / totalRevenue) * 100).toFixed(2))
						: null,
				purchaseToCOGSRatio:
					estimatedCogs > 0
						? Number(((totalNetPurchase / estimatedCogs) * 100).toFixed(2))
						: null,
			},
		});
	} catch (error) {
		console.error("GET /api/net-purchase/comparison failed:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch comparison data" },
			{ status: 500 },
		);
	}
}
