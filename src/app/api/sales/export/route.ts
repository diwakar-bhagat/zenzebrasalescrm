import { type NextRequest, NextResponse } from "next/server";
import { getCategoryAov, getCategoryBillCuts } from "@/lib/business-logic/aov";
import {
	cleanDashboardFilters,
	getComparisonPeriods,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { getCustomerIntelligence } from "@/lib/business-logic/customer-intelligence";
import { getPaymentAnalysis } from "@/lib/business-logic/payment-analysis";
import {
	getBrandPerformance,
	getSkuPerformance,
} from "@/lib/business-logic/sales";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

// Effectively "no limit" — comfortably above the size of this dataset (see CLAUDE.md ground truth).
const EXPORT_ALL_LIMIT = 100000;

const DATASETS = [
	"customers",
	"skus",
	"brands",
	"payments",
	"bill-cuts",
	"aov",
] as const;
type Dataset = (typeof DATASETS)[number];

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
		const dataset = searchParams.get("dataset") as Dataset | null;
		if (!dataset || !DATASETS.includes(dataset)) {
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

		switch (dataset) {
			case "customers": {
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
			case "skus": {
				const rows = await getSkuPerformance(
					sql,
					periods,
					filters,
					EXPORT_ALL_LIMIT,
				);
				return NextResponse.json({ success: true, data: { rows } });
			}
			case "brands": {
				const rows = await getBrandPerformance(sql, periods, filters);
				return NextResponse.json({ success: true, data: { rows } });
			}
			case "payments": {
				const payments = await getPaymentAnalysis(sql, periods, filters);
				return NextResponse.json({
					success: true,
					data: { rows: payments.methods },
				});
			}
			case "bill-cuts": {
				const rows = await getCategoryBillCuts(sql, periods, filters);
				return NextResponse.json({ success: true, data: { rows } });
			}
			case "aov": {
				const rows = await getCategoryAov(sql, periods, filters);
				return NextResponse.json({ success: true, data: { rows } });
			}
		}
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
