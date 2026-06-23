import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { cleanDashboardFilters, getComparisonPeriods, getDefaultPeriod } from "@/lib/business-logic/comparison";
import { getCustomerIntelligence } from "@/lib/business-logic/customer-intelligence";
import { getDailyHealthMetrics, getSkuPerformance } from "@/lib/business-logic/sales";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { FOOD_CATEGORIES } from "@/lib/business-logic/filter-sql";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const defaults = getDefaultPeriod().current;
    const filters = cleanDashboardFilters({
      startDate: searchParams.get("startDate") ?? defaults.startDate,
      endDate: searchParams.get("endDate") ?? defaults.endDate,
      store: searchParams.get("store") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      brand: searchParams.get("brand") ?? undefined,
      sku: searchParams.get("sku") ?? undefined,
      categoryScope: (searchParams.get("categoryScope") as DashboardFilters["categoryScope"]) ?? "all",
      compareMode: (searchParams.get("compareMode") as DashboardFilters["compareMode"]) ?? undefined,
      compareStartDate: searchParams.get("compareStartDate") ?? undefined,
      compareEndDate: searchParams.get("compareEndDate") ?? undefined,
    } satisfies DashboardFilters);
    const periods = getComparisonPeriods(filters);
    const food = filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;

    const [health, storePerformance, skuPerformance, customers] = await Promise.all([
      getDailyHealthMetrics(sql, periods, filters),
      getStorePerformance(sql, periods, filters),
      getSkuPerformance(sql, periods, filters),
      getCustomerIntelligence(sql, periods, filters),
    ]);

    const trendsResult = await sql`
      SELECT sale_date::text AS date, COALESCE(SUM(net_amount),0)::numeric AS revenue,
        COUNT(DISTINCT bill_no)::integer AS orders, COALESCE(SUM(quantity),0)::integer AS units
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      GROUP BY sale_date ORDER BY sale_date ASC`;

    const recentOrdersResult = await sql`
      SELECT id, bill_no, store_display_name, item_name, quantity, net_amount, customer_mobile, sale_date::text AS sale_date
      FROM sales_fact_v
      WHERE sale_date >= ${periods.currentStart}::date AND sale_date <= ${periods.currentEnd}::date
        AND (${filters.store ?? null}::text IS NULL OR billed_by = ${filters.store ?? null})
        AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
        AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
        AND (${filters.sku ?? null}::text IS NULL OR sku_code = ${filters.sku ?? null})
        AND (${food ?? null}::text[] IS NULL OR category <> ALL(${food ?? null}::text[]))
      ORDER BY sale_date DESC, id DESC LIMIT 20`;

    return NextResponse.json({
      success: true,
      data: {
        filters, periods,
        salesKpis: health.salesKpis,
        aovKpi: health.aovKpi,
        storePerformance,
        productPerformance: skuPerformance,
        customers: {
          current: customers.totalCustomers,
          previous: customers.previousCustomers,
          growth: customers.customersGrowthPct,
        },
        dailyTrends: trendsResult.map((row) => ({
          date: row.date, revenue: Number(row.revenue ?? 0), orders: Number(row.orders ?? 0),
          units: Number(row.units ?? 0), profit: Math.round(Number(row.revenue ?? 0) * 0.26),
        })),
        recentOrders: recentOrdersResult.map((row) => ({
          id: Number(row.id), billNo: String(row.bill_no), store: String(row.store_display_name),
          productName: String(row.item_name), quantity: Number(row.quantity), netAmount: Number(row.net_amount),
          customerId: row.customer_mobile ? String(row.customer_mobile) : `CUST-${String(row.id).slice(-4)}`,
          saleDate: String(row.sale_date),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch extended dashboard data:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
