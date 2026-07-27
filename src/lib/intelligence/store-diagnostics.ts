import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { ComparisonPeriods } from "@/lib/business-logic/comparison";
import { getStoreProfitability } from "@/lib/business-logic/profitability";
import { diagnoseStore } from "@/lib/business-logic/store-diagnosis";
import { getStoreForecast } from "@/lib/business-logic/store-forecast";
import {
	getStoreAovBillsHistory,
	getStorePerformance,
} from "@/lib/business-logic/store-performance";
import type { DashboardFilters } from "@/lib/founder/types";

type FounderSql = NeonQueryFunction<false, false>;

/**
 * Per-store diagnosis + forecast composition, shared by /api/sales/store-overview
 * and /api/sales/dashboard's rootCause field. Extracted verbatim from the logic
 * that used to be inlined only in the store-overview route, so both routes stay
 * on one source of truth instead of re-deriving this twice.
 *
 * Composition only — every calculation (getStorePerformance, getStoreAovBillsHistory,
 * diagnoseStore, getStoreForecast, getStoreProfitability) is untouched business logic.
 */
export async function getStoreDiagnostics(
	db: FounderSql,
	periods: ComparisonPeriods,
	filters: DashboardFilters,
) {
	const performances = await getStorePerformance(db, periods, filters);

	const storeProfitability = await getStoreProfitability(db, periods, filters);
	const profitByBilledBy = new Map(
		storeProfitability.map((s) => [s.billedBy, s]),
	);

	const aovBillsHistory = await getStoreAovBillsHistory(db, periods, filters);

	const stores = await Promise.all(
		performances.map(async (perf) => {
			const forecast = await getStoreForecast(db, filters, perf.billedBy);
			const diagnosis = diagnoseStore(
				perf.performance.revenue.growth,
				perf.performance.billCuts.growth,
				perf.performance.aov.growth,
			);

			const history = aovBillsHistory.find(
				(h: any) => h.billedBy === perf.billedBy,
			) || {
				periods: [],
				diagnosis: {
					type: "STABLE",
					owner: "STORE_OPS",
					message: "",
					affectedCategories: [],
				},
				momentum: { billCutsTrend: "stable", aovTrend: "stable" },
				revenueDriver: "",
			};

			const profit = profitByBilledBy.get(perf.billedBy);

			return {
				name: perf.name,
				billedBy: perf.billedBy,
				// Profit Intelligence — net sales / net purchase / gross profit / margin %
				netSales: profit?.netSales ?? perf.performance.revenue.current,
				netPurchase: profit?.netPurchase ?? 0,
				grossProfit: profit?.grossProfit ?? perf.performance.revenue.current,
				marginPercent: profit?.marginPercent ?? null,
				hasPurchase: profit?.hasPurchase ?? false,
				// Flattened metrics for the final production schema
				currentRevenue: perf.performance.revenue.current,
				previousRevenue: perf.performance.revenue.previous,
				growth:
					perf.performance.revenue.growth === "NEW STORE"
						? 0
						: perf.performance.revenue.growth,
				currentBills: perf.performance.billCuts.current,
				previousBills: perf.performance.billCuts.previous,
				aovCurrent: perf.performance.aov.current,
				aovPrevious: perf.performance.aov.previous,
				// Preserved nested keys for backwards compatibility
				performance: perf.performance,
				contributionPercent: perf.contributionPercent,
				forecast: {
					workingDaysPassed: forecast.workingDaysPassed,
					remainingWorkingDays: forecast.remainingWorkingDays,
					runRate: forecast.runRate,
					expectedClosing: forecast.expectedClosing,
					previousMonthClosing: forecast.previousMonthClosing,
					growthVsPrevMonth: forecast.growthVsPrevMonth,
					confidence: forecast.confidence,
					reason: forecast.reason,
				},
				diagnosis: {
					type: diagnosis.type,
					owner: diagnosis.owner,
					message: diagnosis.message,
					priority: diagnosis.priority,
				},
				aovBills: {
					periods: history.periods,
					diagnosis: history.diagnosis,
					momentum: history.momentum,
					revenueDriver: history.revenueDriver,
				},
			};
		}),
	);

	return {
		hasPurchaseData: storeProfitability.some((s) => s.hasPurchase),
		stores,
	};
}

export type StoreDiagnosticsResult = Awaited<
	ReturnType<typeof getStoreDiagnostics>
>;
export type StoreDiagnosticRow = StoreDiagnosticsResult["stores"][number];
