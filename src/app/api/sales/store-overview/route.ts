import { type NextRequest, NextResponse } from "next/server";
import {
	type ComparisonPeriods,
	cleanDashboardFilters,
	formatDateShort,
	getComparisonPeriods,
	getDefaultPeriod,
} from "@/lib/business-logic/comparison";
import { getStoreProfitability } from "@/lib/business-logic/profitability";
import { getStoreCommandDefaultPeriod } from "@/lib/business-logic/store-command-period";
import { diagnoseStore } from "@/lib/business-logic/store-diagnosis";
import { getStoreForecast } from "@/lib/business-logic/store-forecast";
import {
	getStoreAovBillsHistory,
	getStorePerformance,
} from "@/lib/business-logic/store-performance";
import { getStoreTrend } from "@/lib/business-logic/store-trend";
import { sql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/founder/types";

export const runtime = "nodejs";

function getPeriodResponseLabel(startDate: string, endDate: string): string {
	const monthsFull = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	const [sYear, sMonth, sDay] = startDate.split("-");
	const [eYear, eMonth, eDay] = endDate.split("-");

	if (sYear === eYear && sMonth === eMonth) {
		const monthName = monthsFull[parseInt(sMonth, 10) - 1];
		const startDay = parseInt(sDay, 10);
		const endDay = parseInt(eDay, 10);
		return `${monthName} ${sYear} (${startDay}-${endDay})`;
	}

	return `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = req.nextUrl;
		const startParam = searchParams.get("startDate");
		const endParam = searchParams.get("endDate");

		let periods: ComparisonPeriods;
		let periodMode: "default_mtd" | "custom" = "custom";

		if (!startParam || !endParam) {
			const defaultPeriod = getStoreCommandDefaultPeriod();
			periods = {
				currentStart: defaultPeriod.current.startDate,
				currentEnd: defaultPeriod.current.endDate,
				previousStart: defaultPeriod.previous.startDate,
				previousEnd: defaultPeriod.previous.endDate,
				label: `Current: ${formatDateShort(defaultPeriod.current.startDate)} – ${formatDateShort(defaultPeriod.current.endDate)} | Compared: vs ${formatDateShort(defaultPeriod.previous.startDate)} – ${formatDateShort(defaultPeriod.previous.endDate)}`,
				comparisonLabel: `vs ${formatDateShort(defaultPeriod.previous.startDate)} – ${formatDateShort(defaultPeriod.previous.endDate)}`,
			};
			periodMode = "default_mtd";
		} else {
			let startDateVal = startParam;
			let endDateVal = endParam;

			// Clamp future end date to today (India Time)
			const defaultPeriod = getStoreCommandDefaultPeriod();
			const todayStr = defaultPeriod.current.endDate;
			if (endDateVal > todayStr) {
				endDateVal = todayStr;
			}
			if (startDateVal > todayStr) {
				startDateVal = todayStr;
			}

			const tempFilters = {
				startDate: startDateVal,
				endDate: endDateVal,
				compareMode: searchParams.get(
					"compareMode",
				) as DashboardFilters["compareMode"],
				compareStartDate: searchParams.get("compareStartDate") ?? undefined,
				compareEndDate: searchParams.get("compareEndDate") ?? undefined,
			} as DashboardFilters;

			periods = getComparisonPeriods(tempFilters);
		}

		const filters = cleanDashboardFilters({
			startDate: periods.currentStart,
			endDate: periods.currentEnd,
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

		// 1. Get store performance comparison
		const performances = await getStorePerformance(sql, periods, filters);

		// 1.1 Profit Intelligence — net sales, net purchase, gross profit, margin %
		const storeProfitability = await getStoreProfitability(
			sql,
			periods,
			filters,
		);
		const profitByBilledBy = new Map(
			storeProfitability.map((s) => [s.billedBy, s]),
		);

		// 1.5 Get store AOV/Bills history
		const aovBillsHistory = await getStoreAovBillsHistory(
			sql,
			periods,
			filters,
		);

		// 2. Fetch forecast and run diagnosis for each store
		const storesData = await Promise.all(
			performances.map(async (perf) => {
				const forecast = await getStoreForecast(sql, filters, perf.billedBy);
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

		// 3. Get normalized trends
		const trends = await getStoreTrend(sql, filters);

		// Debug log before returning response
		console.log({
			currentPeriod: {
				start: periods.currentStart,
				end: periods.currentEnd,
			},
			previousPeriod: {
				start: periods.previousStart,
				end: periods.previousEnd,
			},
			storesFound: storesData.map((s) => s.name),
		});

		const getPeriodMonthName = (dateStr: string) => {
			const monthsFull = [
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December",
			];
			const [, m] = dateStr.split("-");
			return monthsFull[parseInt(m, 10) - 1];
		};

		const formatShortRange = (startStr: string, endStr: string) => {
			const monthsShort = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			const sParts = startStr.split("-");
			const eParts = endStr.split("-");
			if (sParts.length !== 3 || eParts.length !== 3)
				return `${startStr} - ${endStr}`;
			const sDay = parseInt(sParts[2], 10);
			const sMonth = monthsShort[parseInt(sParts[1], 10) - 1];
			const eDay = parseInt(eParts[2], 10);
			const eMonth = monthsShort[parseInt(eParts[1], 10) - 1];
			return `${sDay.toString().padStart(2, "0")} ${sMonth} - ${eDay.toString().padStart(2, "0")} ${eMonth}`;
		};

		const context = {
			title:
				periodMode === "default_mtd"
					? `${getPeriodMonthName(periods.currentStart)} ${periods.currentStart.split("-")[0]} MTD vs ${getPeriodMonthName(periods.previousStart)} ${periods.previousStart.split("-")[0]} MTD`
					: `${getPeriodResponseLabel(periods.currentStart, periods.currentEnd)} vs ${getPeriodResponseLabel(periods.previousStart, periods.previousEnd)}`,
			current: formatShortRange(periods.currentStart, periods.currentEnd),
			previous: formatShortRange(periods.previousStart, periods.previousEnd),
		};

		return NextResponse.json({
			success: true,
			data: {
				context,
				period: {
					mode: periodMode,
					current: {
						label: getPeriodResponseLabel(
							periods.currentStart,
							periods.currentEnd,
						),
						start: periods.currentStart,
						end: periods.currentEnd,
					},
					previous: {
						label: getPeriodResponseLabel(
							periods.previousStart,
							periods.previousEnd,
						),
						start: periods.previousStart,
						end: periods.previousEnd,
					},
				},
				comparisonLabel: periods.comparisonLabel,
				hasPurchaseData: storeProfitability.some((s) => s.hasPurchase),
				stores: storesData,
				trends,
			},
		});
	} catch (error) {
		console.error("Store Overview API failed:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
