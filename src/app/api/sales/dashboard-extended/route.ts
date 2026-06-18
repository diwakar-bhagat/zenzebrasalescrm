import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { cleanDashboardFilters, getComparisonPeriods, calculateGrowth } from "@/lib/business-logic/comparison";
import { getSalesKpis, getCategoryPerformance, getProductPerformance } from "@/lib/business-logic/sales";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { getAovKpi } from "@/lib/business-logic/aov";
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

    // 1. Fetch existing business logic metrics in parallel
    const [salesKpis, categoryPerformance, productPerformance, aovKpi, storePerformance] = await Promise.all([
      getSalesKpis(sql, periods, filters),
      getCategoryPerformance(sql, periods, filters),
      getProductPerformance(sql, periods, filters),
      getAovKpi(sql, periods, filters),
      getStorePerformance(sql, periods, filters),
    ]);

    // 2. Fetch unique customer counts
    const customersResult = await sql`
      SELECT
        COUNT(DISTINCT CASE WHEN sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date AND customer_id IS NOT NULL AND customer_id != '' THEN customer_id END)::integer AS current_customers,
        COUNT(DISTINCT CASE WHEN sale_date >= ${periods.previousStart}::date AND sale_date <= ${periods.previousEnd}::date AND customer_id IS NOT NULL AND customer_id != '' THEN customer_id END)::integer AS previous_customers
      FROM sales_fact
      WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
    `;
    const currentCusts = Number(customersResult[0]?.current_customers ?? 0);
    const prevCusts = Number(customersResult[0]?.previous_customers ?? 0);
    const customerGrowth = calculateGrowth(currentCusts, prevCusts);

    // 3. Daily trends for charts (Current Period)
    const trendsResult = await sql`
      SELECT
        sale_date::text AS date,
        COALESCE(SUM(net_amount), 0)::numeric AS revenue,
        COUNT(DISTINCT bill_no)::integer AS orders,
        COALESCE(SUM(quantity), 0)::integer AS units
      FROM sales_fact
      WHERE sale_date >= ${periods.currentStart}::date
        AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
      GROUP BY sale_date
      ORDER BY sale_date ASC
    `;

    const dailyTrends = trendsResult.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue ?? 0),
      orders: Number(row.orders ?? 0),
      units: Number(row.units ?? 0),
      profit: Math.round(Number(row.revenue ?? 0) * 0.26),
    }));

    // 4. Recent transactions list
    const recentOrdersResult = await sql`
      SELECT
        id,
        bill_no,
        store,
        product_name,
        quantity,
        net_amount,
        customer_id,
        sale_date::text AS sale_date
      FROM sales_fact
      WHERE (${filters.store ?? null}::text IS NULL OR store = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku ILIKE '%' || ${filters.sku ?? null} || '%')
      ORDER BY sale_date DESC, id DESC
      LIMIT 20
    `;

    const recentOrders = recentOrdersResult.map((row) => ({
      id: Number(row.id),
      billNo: String(row.bill_no),
      store: String(row.store),
      productName: String(row.product_name),
      quantity: Number(row.quantity),
      netAmount: Number(row.net_amount),
      customerId: row.customer_id ? String(row.customer_id) : "CUST-" + String(row.id).slice(-4),
      saleDate: String(row.sale_date),
    }));

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
        customers: {
          current: currentCusts,
          previous: prevCusts,
          growth: customerGrowth,
        },
        dailyTrends,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Failed to fetch extended dashboard data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch extended dashboard data",
      },
      { status: 500 },
    );
  }
}
