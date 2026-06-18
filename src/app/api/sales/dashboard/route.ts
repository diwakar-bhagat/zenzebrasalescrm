import { type NextRequest, NextResponse } from "next/server";

import { getAovKpi } from "@/lib/business-logic/aov";
import { cleanDashboardFilters, getComparisonPeriods } from "@/lib/business-logic/comparison";
import { analyzeRevenueDriver } from "@/lib/business-logic/revenue-driver";
import { getSalesKpis, getCategoryPerformance, getProductPerformance } from "@/lib/business-logic/sales";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

async function getDefaultDateRange() {
  const result = await sql`
    SELECT
      COALESCE(MAX(sale_date), CURRENT_DATE)::text AS end_date,
      (COALESCE(MAX(sale_date), CURRENT_DATE)::date - INTERVAL '29 days')::date::text AS start_date
    FROM sales_fact
  `;

  return {
    startDate: String(result[0]?.start_date ?? new Date().toISOString().slice(0, 10)),
    endDate: String(result[0]?.end_date ?? new Date().toISOString().slice(0, 10)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const defaults = await getDefaultDateRange();
    const filters = cleanDashboardFilters({
      startDate: searchParams.get("startDate") ?? defaults.startDate,
      endDate: searchParams.get("endDate") ?? defaults.endDate,
      store: searchParams.get("store") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      brand: searchParams.get("brand") ?? undefined,
      sku: searchParams.get("sku") ?? undefined,
    } satisfies DashboardFilters);
    const periods = getComparisonPeriods(filters);

    const [salesKpis, categoryPerformance, productPerformance, aovKpi, storePerformance] = await Promise.all([
      getSalesKpis(sql, periods, filters),
      getCategoryPerformance(sql, periods, filters),
      getProductPerformance(sql, periods, filters),
      getAovKpi(sql, periods, filters),
      getStorePerformance(sql, periods, filters),
    ]);

    const revenueDriver = analyzeRevenueDriver(
      salesKpis.revenue.growth,
      salesKpis.billCuts.growth,
      aovKpi.growth,
    );

    return NextResponse.json({
      success: true,
      data: {
        filters,
        periods,
        salesKpis,
        categoryPerformance,
        productPerformance,
        aovKpi,
        storePerformance,
        revenueDriver,
      },
    });
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data",
      },
      { status: 500 },
    );
  }
}
