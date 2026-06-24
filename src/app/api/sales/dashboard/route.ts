import { type NextRequest, NextResponse } from "next/server";

import { getCategoryAov, getCategoryBillCuts } from "@/lib/business-logic/aov";
import {
	cleanDashboardFilters,
	getComparisonPeriods,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { getCustomerIntelligence } from "@/lib/business-logic/customer-intelligence";
import { getPaymentAnalysis } from "@/lib/business-logic/payment-analysis";
import { computeRevenueDriver } from "@/lib/business-logic/revenue-driver";
import {
	getBrandPerformance,
	getDailyHealthMetrics,
	getSkuPerformance,
} from "@/lib/business-logic/sales";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

function getDefaultDateRange() {
	const defaults = getDefaultPeriod();
	return {
		startDate: defaults.current.startDate,
		endDate: defaults.current.endDate,
	};
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = req.nextUrl;
		const defaults = getDefaultDateRange();
		const filters = cleanDashboardFilters({
			startDate: searchParams.get("startDate") ?? defaults.startDate,
			endDate: searchParams.get("endDate") ?? defaults.endDate,
			store: searchParams.get("store") ?? undefined,
			category: searchParams.get("category") ?? undefined,
			brand: searchParams.get("brand") ?? undefined,
			sku: searchParams.get("sku") ?? undefined,
			categoryScope:
				(searchParams.get(
					"categoryScope",
				) as DashboardFilters["categoryScope"]) ?? "all",
			compareMode:
				(searchParams.get("compareMode") as DashboardFilters["compareMode"]) ??
				undefined,
			compareStartDate: searchParams.get("compareStartDate") ?? undefined,
			compareEndDate: searchParams.get("compareEndDate") ?? undefined,
		} satisfies DashboardFilters);
		const periods = getComparisonPeriods(filters);

		let skuName: string | null = null;
		if (filters.sku) {
			const [skuRow] = await sql`
        SELECT COALESCE(MAX(item_name), ${filters.sku}) AS item_name
        FROM sales_fact_v
        WHERE sku_code = ${filters.sku}
      `;
			if (skuRow) {
				skuName = skuRow.item_name;
			}
		}

		const [
			dailyHealthResult,
			storePerformance,
			brandPerformance,
			skuPerformance,
			billCutAnalysis,
			aovAnalysis,
			customerIntelligence,
			paymentAnalysis,
		] = await Promise.all([
			getDailyHealthMetrics(sql, periods, filters),
			getStorePerformance(sql, periods, filters),
			getBrandPerformance(sql, periods, filters),
			getSkuPerformance(sql, periods, filters),
			getCategoryBillCuts(sql, periods, filters),
			getCategoryAov(sql, periods, filters),
			getCustomerIntelligence(sql, periods, filters),
			getPaymentAnalysis(sql, periods, filters),
		]);

		const revenueDriver = computeRevenueDriver(
			dailyHealthResult.salesKpis.revenue.current,
			dailyHealthResult.salesKpis.revenue.previous,
			dailyHealthResult.salesKpis.billCuts.current,
			dailyHealthResult.salesKpis.billCuts.previous,
		);

		return NextResponse.json({
			success: true,
			data: {
				filters,
				periods,
				comparisonLabel: periods.comparisonLabel,
				skuName,
				dailyHealth: dailyHealthResult.metrics,
				salesKpis: dailyHealthResult.salesKpis,
				aovKpi: dailyHealthResult.aovKpi,
				storePerformance,
				brandPerformance,
				skuPerformance,
				billCutAnalysis,
				aovAnalysis,
				customerIntelligence,
				paymentAnalysis,
				revenueDriver,
			},
		});
	} catch (error) {
		console.error("Failed to fetch dashboard data:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch dashboard data",
			},
			{ status: 500 },
		);
	}
}
