/**
 * Store-local time.
 *
 * `sales_fact.sale_date` is a calendar date in the stores' timezone, not UTC — a sale rung up
 * at 22:00 IST belongs to that day's trading, and Odoo's naive-UTC timestamps are converted on
 * ingestion.
 *
 * Everything that decides "what is today" must therefore agree with that definition. UTC does
 * not: between 00:00 and 05:30 IST the UTC calendar date is still yesterday, so a query bounded
 * by a UTC "today" silently excludes the entire early-morning window — and, worse, excludes the
 * whole current trading day for anyone looking at the dashboard after midnight.
 */

export const STORE_TIMEZONE = "Asia/Kolkata";

/** en-CA yields YYYY-MM-DD, which is what the API and SQL both expect. */
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: STORE_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** Formats an instant as a store-local calendar date (YYYY-MM-DD). */
export function formatStoreDate(date: Date): string {
	return dateFormatter.format(date);
}

/** Today's date in the stores' timezone. */
export function storeToday(): string {
	return formatStoreDate(new Date());
}

/** `n` days before today, store-local. */
export function storeDaysAgo(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return formatStoreDate(d);
}

/**
 * SQL expression for today's date in the stores' timezone.
 *
 * Use in place of CURRENT_DATE, which Postgres evaluates in the server's timezone (UTC on
 * Neon) and which therefore disagrees with sale_date for five and a half hours every day.
 */
export const SQL_STORE_TODAY = `(NOW() AT TIME ZONE '${STORE_TIMEZONE}')::date`;
