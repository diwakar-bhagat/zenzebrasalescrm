import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { DashboardFilters } from "@/lib/founder/types";
import { getMonthCalendarStats } from "./calendar";
import { FOOD_CATEGORIES } from "./filter-sql";

type FounderSql = NeonQueryFunction<false, false>;

export interface StoreForecastResult {
	workingDaysPassed: number;
	remainingWorkingDays: number;
	runRate: number;
	expectedClosing: number | null;
	previousMonthClosing: number;
	growthVsPrevMonth: number | "NEW STORE" | null;
	confidence: "HIGH" | "LOW";
	reason: string;
}

function retailFilter(filters: DashboardFilters) {
	return filters.categoryScope === "retail" ? [...FOOD_CATEGORIES] : null;
}

export async function getStoreForecast(
	db: FounderSql,
	filters: DashboardFilters,
	billedBy: string,
): Promise<StoreForecastResult> {
	const foodCategories = retailFilter(filters);
	const currentEnd = filters.endDate;

	// 1. Fetch calendar stats
	const calendar = await getMonthCalendarStats(db, currentEnd, billedBy);
	const completedDays = calendar.completedDays;
	const remainingDays = calendar.remainingDays;

	// 2. Fetch MTD revenue for current month
	const mtdResult = await db`
    SELECT COALESCE(SUM(net_amount), 0) AS mtd_revenue
    FROM sales_fact_v
    WHERE sale_date >= date_trunc('month', ${currentEnd}::date)::date
      AND sale_date <= ${currentEnd}::date
      AND billed_by = ${billedBy}
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR (sku_code ILIKE '%' || ${filters.sku ?? null} || '%' OR item_name ILIKE '%' || ${filters.sku ?? null} || '%'))
      AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}))
  `;
	const currentMtdRevenue = Number(mtdResult[0]?.mtd_revenue ?? 0);

	// 3. Fetch previous month total final closing revenue
	const prevResult = await db`
    SELECT COALESCE(SUM(net_amount), 0) AS prev_revenue
    FROM sales_fact_v
    WHERE sale_date >= (date_trunc('month', ${currentEnd}::date) - INTERVAL '1 month')::date
      AND sale_date <= (date_trunc('month', ${currentEnd}::date) - INTERVAL '1 day')::date
      AND billed_by = ${billedBy}
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.brand ?? null}::text IS NULL OR brand = ${filters.brand ?? null})
      AND (${filters.sku ?? null}::text IS NULL OR (sku_code ILIKE '%' || ${filters.sku ?? null} || '%' OR item_name ILIKE '%' || ${filters.sku ?? null} || '%'))
      AND (${foodCategories ?? null}::text[] IS NULL OR category <> ALL(${foodCategories ?? null}))
  `;
	const previousMonthClosing = Number(prevResult[0]?.prev_revenue ?? 0);

	// 4. Calculate metrics with protections
	const isFirstDayOfMonth =
		new Date(`${currentEnd}T00:00:00.000Z`).getUTCDate() === 1;
	if (completedDays === 0 || isFirstDayOfMonth) {
		return {
			workingDaysPassed: 0,
			remainingWorkingDays: calendar.totalDays,
			runRate: 0,
			expectedClosing: null,
			previousMonthClosing,
			growthVsPrevMonth: null,
			confidence: "LOW",
			reason: "Insufficient data (New store or first operating day)",
		};
	}

	const runRate = currentMtdRevenue / completedDays;
	const expectedClosing = currentMtdRevenue + runRate * remainingDays;

	// Forecast confidence check
	let confidence: "HIGH" | "LOW" = "HIGH";
	let reason = "Stable monthly run rate";
	if (completedDays < 7) {
		confidence = "LOW";
		reason = `Based on first ${completedDays} operating days`;
	}

	// Growth compared to previous month closing
	let growthVsPrevMonth: number | "NEW STORE" | null = null;
	if (previousMonthClosing === 0) {
		growthVsPrevMonth = "NEW STORE";
	} else if (expectedClosing !== null) {
		growthVsPrevMonth =
			Math.round(
				((expectedClosing - previousMonthClosing) / previousMonthClosing) *
					1000,
			) / 10;
	}

	return {
		workingDaysPassed: completedDays,
		remainingWorkingDays: remainingDays,
		runRate: Math.round(runRate * 100) / 100,
		expectedClosing: Math.round(expectedClosing * 100) / 100,
		previousMonthClosing,
		growthVsPrevMonth,
		confidence,
		reason,
	};
}
