import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs"; // Match founder dashboard pattern

export async function GET() {
  try {
    // Get latest sale date from sales_fact
    const salesResult = await sql`
      SELECT MAX(date) as latest_sale_date 
      FROM sales_fact
    `;
    
    // Get latest upload timestamp from upload_batches
    const uploadResult = await sql`
      SELECT MAX(uploaded_at) as last_uploaded_at 
      FROM upload_batches
      WHERE status = 'completed'
    `;

    const latestSaleDate = salesResult[0]?.latest_sale_date || null;
    const lastUploadedAt = uploadResult[0]?.last_uploaded_at || null;

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
        dataAgeDays
      }
    });

  } catch (error) {
    console.error("Failed to fetch data freshness:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data freshness" },
      { status: 500 }
    );
  }
}
