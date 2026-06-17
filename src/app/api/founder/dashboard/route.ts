import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getComparisonPeriods } from "@/lib/business-logic/comparison";
import { getSalesKpis, getCategoryPerformance, getProductPerformance } from "@/lib/business-logic/sales";
import { getAovKpi } from "@/lib/business-logic/aov";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { analyzeRevenueDriver } from "@/lib/business-logic/revenue-driver";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    
    // Parse filters
    const daysStr = searchParams.get("days") || "30";
    const days = parseInt(daysStr, 10);
    const category = searchParams.get("category") || undefined;
    const brand = searchParams.get("brand") || undefined;
    const item = searchParams.get("item") || undefined;
    const vendor = searchParams.get("vendor") || undefined;
    const salesperson = searchParams.get("salesperson") || undefined;
    
    // Date range constraint
    let dateFilter = "";
    if (!isNaN(days) && days > 0) {
      dateFilter = `date >= CURRENT_DATE - INTERVAL '${days} days'`;
    }
    
    const filters = {
      category,
      brand,
      item,
      vendor,
      salesperson,
      dateRange: dateFilter || undefined
    };

    // Calculate dates for comparison
    const periods = getComparisonPeriods(days);

    // Fetch all dashboard data concurrently
    const [
      salesKpis,
      categoryPerformance,
      productPerformance,
      aovKpi,
      storePerformance
    ] = await Promise.all([
      getSalesKpis(sql, periods, filters),
      getCategoryPerformance(sql, periods.current, filters),
      getProductPerformance(sql, periods.current, filters),
      getAovKpi(sql, periods, filters),
      getStorePerformance(sql, periods, filters)
    ]);

    const revenueDriver = analyzeRevenueDriver(
      salesKpis.revenue.growth,
      salesKpis.billCuts.growth,
      aovKpi.growth
    );

    return NextResponse.json({
      success: true,
      data: {
        salesKpis,
        categoryPerformance,
        productPerformance,
        aovKpi,
        storePerformance,
        revenueDriver,
        periods
      }
    });

  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
