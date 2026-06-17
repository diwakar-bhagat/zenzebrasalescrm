import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { 
  getDailyHealth, 
  getCategoryPerformance, 
  getBrandPerformance, 
  getProductPerformance, 
  getBillCutAnalysis, 
  getAovAnalysis,
  getComparisonPeriods
} from "@/lib/founder/sql-helpers";

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
      dailyHealth,
      categoryPerformance,
      brandPerformance,
      productPerformance,
      billCutAnalysis,
      aovAnalysis
    ] = await Promise.all([
      getDailyHealth(sql, periods, filters),
      getCategoryPerformance(sql, periods.current, filters),
      getBrandPerformance(sql, periods.current, filters),
      getProductPerformance(sql, periods.current, filters),
      getBillCutAnalysis(sql, periods.current, filters),
      getAovAnalysis(sql, periods, filters)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        dailyHealth,
        categoryPerformance,
        brandPerformance,
        productPerformance,
        billCutAnalysis,
        aovAnalysis,
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
