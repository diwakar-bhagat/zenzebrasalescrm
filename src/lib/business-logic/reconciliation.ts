import type {
	ReconciliationCheck,
	ReconciliationReport,
} from "@/types/customer-intelligence";

/** Default tolerance: partitions of the same rows must match within ₹1. */
const DEFAULT_TOLERANCE = 1;

/** Build a single equality assertion (expected vs actual within tolerance). */
export function check(
	label: string,
	expected: number,
	actual: number,
	tolerance: number = DEFAULT_TOLERANCE,
): ReconciliationCheck {
	const e = Number.isFinite(expected) ? expected : 0;
	const a = Number.isFinite(actual) ? actual : 0;
	const diffAbs = Math.abs(e - a);
	return { label, expected: e, actual: a, diffAbs, ok: diffAbs <= tolerance };
}

/** Combine checks into a report; any failing check produces a warning. */
export function report(checks: ReconciliationCheck[]): ReconciliationReport {
	const warnings = checks
		.filter((c) => !c.ok)
		.map(
			(c) =>
				`Revenue reconciliation failed: ${c.label} (expected ${c.expected.toFixed(
					2,
				)}, got ${c.actual.toFixed(2)}, diff ${c.diffAbs.toFixed(2)})`,
		);
	return { ok: warnings.length === 0, checks, warnings };
}

/** Merge several reports into one combined report. */
export function combine(reports: ReconciliationReport[]): ReconciliationReport {
	const checks = reports.flatMap((r) => r.checks);
	const warnings = reports.flatMap((r) => r.warnings);
	return { ok: warnings.length === 0, checks, warnings };
}
