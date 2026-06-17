import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Force Node.js runtime because edge runtime doesn't fully support the Neon driver we're using
export const runtime = "nodejs";

export async function GET() {
  try {
    // Get total rows and date range
    const statsResult = await sql`
      SELECT 
        COUNT(*) as total_rows,
        MIN(sale_date) as min_date,
        MAX(sale_date) as max_date,
        SUM(net_amount) as total_revenue
      FROM sales_fact
    `;
    
    // Get latest upload batch info
    const latestBatchResult = await sql`
      SELECT 
        id, 
        uploaded_at, 
        row_count, 
        date_range_start, 
        date_range_end, 
        status
      FROM upload_batches
      ORDER BY uploaded_at DESC
      LIMIT 1
    `;

    const stats = statsResult[0] || {};
    const latestBatch = latestBatchResult[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        totalRows: parseInt(stats.total_rows || "0", 10),
        minDate: stats.min_date,
        maxDate: stats.max_date,
        totalRevenue: parseFloat(stats.total_revenue || "0"),
        latestBatch,
        isSeeded: parseInt(stats.total_rows || "0", 10) > 0,
      },
    });
  } catch (error: any) {
    if (error.code === '42P01') {
      // Table doesn't exist yet - return empty state
      return NextResponse.json({
        success: true,
        data: {
          totalRows: 0,
          minDate: null,
          maxDate: null,
          totalRevenue: 0,
          latestBatch: null,
          isSeeded: false,
        },
      });
    }

    console.error("Failed to fetch founder status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch database status" },
      { status: 500 }
    );
  }
}
