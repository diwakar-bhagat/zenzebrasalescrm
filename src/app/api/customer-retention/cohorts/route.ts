import { type NextRequest, NextResponse } from "next/server";
import {
	cleanDashboardFilters,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";
import { getCohortMetrics } from "@/lib/services/cohort.service";

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

		const cohorts = await getCohortMetrics(sql, filters);

		return NextResponse.json({
			success: true,
			data: cohorts,
		});
	} catch (error) {
		console.error("Failed to fetch cohorts:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Failed",
			},
			{ status: 500 },
		);
	}
}
