import { type NextRequest, NextResponse } from "next/server";
import {
	cleanDashboardFilters,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";
import {
	getLtvDistribution,
	getTopCustomers,
} from "@/lib/services/ltv.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = req.nextUrl;
		const defaults = getDefaultPeriod().current;
		const filters = cleanDashboardFilters({
			startDate: searchParams.get("startDate") ?? defaults.startDate,
			endDate: searchParams.get("endDate") ?? defaults.endDate,
			store: searchParams.get("store") ?? undefined,
			categoryScope:
				(searchParams.get(
					"categoryScope",
				) as DashboardFilters["categoryScope"]) ?? "all",
		} as DashboardFilters);

		const [distribution, topCustomers] = await Promise.all([
			getLtvDistribution(sql, filters),
			getTopCustomers(sql, filters),
		]);

		return NextResponse.json({
			success: true,
			data: {
				distribution,
				topCustomers,
			},
		});
	} catch (error) {
		console.error("Failed to fetch LTV analytics:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed",
			},
			{ status: 500 },
		);
	}
}
