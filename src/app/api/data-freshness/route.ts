import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs"; // Match sales dashboard pattern

export async function GET() {
	try {
		// Get latest sale date from sales_fact
		const salesResult = await sql`
      SELECT MAX(sale_date) as latest_sale_date 
      FROM sales_fact
    `;

		// Get latest upload timestamp from upload_batches
		const uploadResult = await sql`
      SELECT MAX(uploaded_at) as last_uploaded_at 
      FROM upload_batches
      WHERE status = 'success'
    `;

		// Row / bill / revenue counts for the freshness header.
		const countsResult = await sql`
      SELECT COUNT(*)::int AS total_rows,
        COUNT(DISTINCT bill_no)::int AS total_bills,
        COALESCE(SUM(net_amount), 0) AS total_revenue
      FROM sales_fact
    `;

		const latestSaleDate = salesResult[0]?.latest_sale_date || null;
		const lastUploadedAt = uploadResult[0]?.last_uploaded_at || null;
		const totalRows = Number(countsResult[0]?.total_rows ?? 0);
		const totalBills = Number(countsResult[0]?.total_bills ?? 0);
		const totalRevenue = Number(countsResult[0]?.total_revenue ?? 0);

		let dataAgeDays = null;
		if (latestSaleDate) {
			// Calculate difference in days between today and latest sale date
			const today = new Date();
			// Reset time to start of day for accurate day calculation
			today.setHours(0, 0, 0, 0);

			const saleDate = new Date(latestSaleDate);
			saleDate.setHours(0, 0, 0, 0);

			const diffTime = Math.abs(today.getTime() - saleDate.getTime());
			dataAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		}

		return NextResponse.json({
			success: true,
			data: {
				latestSaleDate,
				lastUploadedAt,
				dataAgeDays,
				totalRows,
				totalBills,
				totalRevenue,
			},
		});
	} catch (error) {
		console.error("Failed to fetch data freshness:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to fetch data freshness" },
			{ status: 500 },
		);
	}
}
