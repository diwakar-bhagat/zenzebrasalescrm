import { type NextRequest, NextResponse } from "next/server";

import {
	cleanDashboardFilters,
	getComparisonPeriods,
} from "@/lib/business-logic/comparison";
import { getCustomerConcentration } from "@/lib/business-logic/customer-concentration";
import { headlineMonth1Retention } from "@/lib/business-logic/customer-quality-score";
import { getRetentionCohort } from "@/lib/business-logic/customer-retention-cohort";
import { getRevenueComposition } from "@/lib/business-logic/customer-revenue-composition";
import { buildDecisionGraph } from "@/lib/business-logic/decision-graph";
import { getCustomerSignals } from "@/lib/business-logic/signals/customer-signals";
import { getStoreSignals } from "@/lib/business-logic/signals/store-signals";
import { getStoreCommandDefaultPeriod } from "@/lib/business-logic/store-command-period";
import { getStorePerformance } from "@/lib/business-logic/store-performance";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";
import type { BusinessSignal } from "@/types/business-signal";

export const runtime = "nodejs";

/**
 * Founder Priorities (Decision Graph) API — cross-domain.
 *
 * Runs each domain's signal producer, feeds the standardized BusinessSignal[]
 * into the Decision Graph (dedup by root cause, rank by Impact×Confidence×Urgency),
 * and returns ranked root-cause clusters. Domains plug in without changing the
 * graph. Currently wired: Customer, Store. (Inventory/SKU/Category/Finance next.)
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = req.nextUrl;

		// Anchor the default window to the latest data date (MTD-of-data vs prior
		// month), not real-today — otherwise stale data fakes declines and the
		// priorities become false alarms. Explicit date params override.
		const [maxRow] =
			await sql`SELECT MAX(sale_date)::text AS d FROM sales_fact_v`;
		const anchor = getStoreCommandDefaultPeriod(maxRow?.d ?? undefined);

		const filters = cleanDashboardFilters({
			startDate: searchParams.get("startDate") ?? anchor.current.startDate,
			endDate: searchParams.get("endDate") ?? anchor.current.endDate,
			store: searchParams.get("store") ?? undefined,
			category: searchParams.get("category") ?? undefined,
			brand: searchParams.get("brand") ?? undefined,
			sku: searchParams.get("sku") ?? undefined,
			categoryScope:
				(searchParams.get(
					"categoryScope",
				) as DashboardFilters["categoryScope"]) ?? "all",
		} satisfies DashboardFilters);

		const periods = getComparisonPeriods(filters);

		const [composition, concentration, retentionCohort, stores] =
			await Promise.all([
				getRevenueComposition(sql, periods, filters),
				getCustomerConcentration(sql, periods, filters),
				getRetentionCohort(sql, periods, filters),
				getStorePerformance(sql, periods, filters),
			]);

		const month1RetentionPct = headlineMonth1Retention(
			retentionCohort,
			periods.currentEnd,
		);

		const signals: BusinessSignal[] = [
			...getCustomerSignals({
				composition,
				concentration,
				month1RetentionPct,
				store: filters.store,
			}),
			...getStoreSignals(stores),
		];

		const graph = buildDecisionGraph(signals);

		return NextResponse.json({
			success: true,
			data: {
				filters,
				periods,
				comparisonLabel: periods.comparisonLabel,
				domainsWired: ["customer", "store"],
				signals,
				graph,
			},
		});
	} catch (error) {
		console.error("Failed to build founder priorities:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to build founder priorities",
			},
			{ status: 500 },
		);
	}
}
