import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Helper to check if a date (UTC) is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
	const day = date.getUTCDay();
	return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Calculates working days (Monday-Friday) for a given date range,
 * checking against the store_calendar database overrides if available.
 */
export async function getWorkingDaysInRange(
	db: NeonQueryFunction<false, false>,
	startDate: string,
	endDate: string,
	billedBy?: string,
): Promise<number> {
	const start = new Date(`${startDate}T00:00:00.000Z`);
	const end = new Date(`${endDate}T00:00:00.000Z`);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return 0;
	}

	// 1. Attempt to fetch overrides from the store_calendar table for this store and date range
	if (billedBy) {
		try {
			const overrides = await db`
        SELECT date::text AS date, is_open, holiday_name
        FROM store_calendar
        WHERE billed_by = ${billedBy} AND date >= ${startDate}::date AND date <= ${endDate}::date
      `;

			if (overrides && overrides.length > 0) {
				const overrideMap = new Map<string, boolean>();
				for (const row of overrides) {
					overrideMap.set(row.date, row.is_open);
				}

				let workingDays = 0;
				const current = new Date(start);
				while (current <= end) {
					const dateStr = current.toISOString().slice(0, 10);
					if (overrideMap.has(dateStr)) {
						if (overrideMap.get(dateStr) === true) {
							workingDays++;
						}
					} else if (!isWeekend(current)) {
						workingDays++;
					}
					current.setUTCDate(current.getUTCDate() + 1);
				}
				return workingDays;
			}
		} catch (error) {
			// If store_calendar table is not setup or fails, fall back to standard calendar logic
			console.warn(
				"store_calendar query failed, falling back to standard weekend logic:",
				error,
			);
		}
	}

	// 2. Default standard Monday-Friday logic
	let workingDays = 0;
	const current = new Date(start);
	while (current <= end) {
		if (!isWeekend(current)) {
			workingDays++;
		}
		current.setUTCDate(current.getUTCDate() + 1);
	}
	return workingDays;
}

export interface CalendarStats {
	totalDays: number;
	completedDays: number;
	remainingDays: number;
	monthName: string;
	year: number;
}

/**
 * Returns month calendar stats:
 * total working days in the month,
 * completed working days (up to currentEnd),
 * remaining working days in the month.
 */
export async function getMonthCalendarStats(
	db: NeonQueryFunction<false, false>,
	currentEnd: string,
	billedBy?: string,
): Promise<CalendarStats> {
	const date = new Date(`${currentEnd}T00:00:00.000Z`);
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth(); // 0-indexed

	// Start of the month
	const startOfMonth = new Date(Date.UTC(year, month, 1));
	const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

	// End of the month
	const endOfMonth = new Date(Date.UTC(year, month + 1, 0));
	const endOfMonthStr = endOfMonth.toISOString().slice(0, 10);

	// Total working days in this month
	const total = await getWorkingDaysInRange(
		db,
		startOfMonthStr,
		endOfMonthStr,
		billedBy,
	);

	// Completed working days: from start of month to currentEnd
	let completed = await getWorkingDaysInRange(
		db,
		startOfMonthStr,
		currentEnd,
		billedBy,
	);
	completed = Math.min(completed, total);

	const remaining = total - completed;

	return {
		totalDays: total,
		completedDays: completed,
		remainingDays: remaining,
		monthName: date.toLocaleDateString("en-US", {
			month: "long",
			timeZone: "UTC",
		}),
		year,
	};
}
