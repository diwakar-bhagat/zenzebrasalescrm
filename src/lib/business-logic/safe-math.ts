/**
 * Numeric guards shared by the Customer Intelligence engines.
 *
 * Every metric passes through these helpers so the API never emits
 * NaN, Infinity, or -Infinity — only finite numbers or explicit null.
 */

/** Coerce any DB/unknown value to a finite number (0 fallback). */
export function toNum(value: unknown): number {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/** Safe division. Returns `fallback` (default 0) when the denominator is 0 or invalid. */
export function safeDiv(
	numerator: number,
	denominator: number,
	fallback = 0,
): number {
	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		denominator === 0
	) {
		return fallback;
	}
	return numerator / denominator;
}

/** Share of `part` in `whole`, expressed as a percentage (0..100), rounded to 1 dp. */
export function sharePct(part: number, whole: number): number {
	return roundTo(safeDiv(part, whole) * 100, 1);
}

/** Round to `digits` decimal places (default 1), always finite. */
export function roundTo(value: number, digits = 1): number {
	if (!Number.isFinite(value)) return 0;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}
