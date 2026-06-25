export interface ComparisonPeriod {
	current: { startDate: string; endDate: string };
	previous: { startDate: string; endDate: string };
}

function parseDate(value: Date | string): Date {
	if (value instanceof Date) return value;
	const parts = value.split("-");
	if (parts.length === 3) {
		const year = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10) - 1;
		const day = parseInt(parts[2], 10);
		return new Date(Date.UTC(year, month, day));
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return new Date();
	}
	return date;
}

export function getStoreCommandDefaultPeriod(
	todayInput?: Date | string,
): ComparisonPeriod {
	let today: Date;
	if (todayInput) {
		today = parseDate(todayInput);
	} else {
		// Get current time, convert to UTC, then shift by +5.5 hours to represent India Time (IST)
		const now = new Date();
		const utc = now.getTime() + now.getTimezoneOffset() * 60000;
		today = new Date(utc + 3600000 * 5.5);
	}

	const currentYear = today.getUTCFullYear();
	const currentMonth = today.getUTCMonth(); // 0-11
	const currentDay = today.getUTCDate();

	const pad = (n: number) => n.toString().padStart(2, "0");
	const currentStartDate = `${currentYear}-${pad(currentMonth + 1)}-01`;
	const currentEndDate = `${currentYear}-${pad(currentMonth + 1)}-${pad(currentDay)}`;

	let prevYear = currentYear;
	let prevMonth = currentMonth - 1;
	if (prevMonth < 0) {
		prevMonth = 11;
		prevYear--;
	}

	// Clamp to the last day of the previous month to avoid overflow (e.g. March 31 -> Feb 28)
	const lastDayOfPrevMonth = new Date(
		Date.UTC(prevYear, prevMonth + 1, 0),
	).getUTCDate();
	const prevDay = Math.min(currentDay, lastDayOfPrevMonth);

	const previousStartDate = `${prevYear}-${pad(prevMonth + 1)}-01`;
	const previousEndDate = `${prevYear}-${pad(prevMonth + 1)}-${pad(prevDay)}`;

	return {
		current: {
			startDate: currentStartDate,
			endDate: currentEndDate,
		},
		previous: {
			startDate: previousStartDate,
			endDate: previousEndDate,
		},
	};
}
