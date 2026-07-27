import { type NextRequest, NextResponse } from "next/server";
import {
	cleanDashboardFilters,
	getComparisonPeriods,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { getCustomerIntelligence } from "@/lib/business-logic/customer-intelligence";
import { getSkuPerformance } from "@/lib/business-logic/sales";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

// Effectively "no limit" — comfortably above the size of this dataset (see CLAUDE.md ground truth).
const EXPORT_ALL_LIMIT = 100000;

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
		const dataset = searchParams.get("dataset");
		if (dataset !== "customers" && dataset !== "skus") {
			return NextResponse.json(
				{ success: false, error: "Unsupported or missing dataset parameter" },
				{ status: 400 },
			);
		}

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

		if (dataset === "customers") {
			const intelligence = await getCustomerIntelligence(
				sql,
				periods,
				filters,
				EXPORT_ALL_LIMIT,
			);
			return NextResponse.json({
				success: true,
				data: { rows: intelligence.topCustomers },
			});
		}

		const skuPerformance = await getSkuPerformance(
			sql,
			periods,
			filters,
			EXPORT_ALL_LIMIT,
		);
		return NextResponse.json({ success: true, data: { rows: skuPerformance } });
	} catch (error) {
		console.error("Failed to export dataset:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to export dataset",
			},
			{ status: 500 },
		);
	}
}
