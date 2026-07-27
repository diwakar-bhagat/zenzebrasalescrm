import { formatCurrency } from "@/lib/utils";

/** Compact rupee label (no decimals), safe on non-finite input. */
export function money(value: number | null | undefined): string {
	const n = Number(value ?? 0);
	return formatCurrency(Number.isFinite(n) ? n : 0, { noDecimals: true });
}

/** Percentage label; renders "—" for null/undefined/non-finite. */
export function pct(value: number | null | undefined, digits = 1): string {
	if (value === null || value === undefined) return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	return `${n.toFixed(digits)}%`;
}

/** Signed growth label (e.g. "+12.3%"), "—" when null. */
export function signedPct(
	value: number | null | undefined,
	digits = 1,
): string {
	if (value === null || value === undefined) return "—";
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Format an ISO "YYYY-MM" month as "Mon YYYY". */
export function monthLabel(iso: string): string {
	const [y, m] = iso.split("-");
	const months = [
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
	const idx = Number(m) - 1;
	if (!y || idx < 0 || idx > 11) return iso;
	return `${months[idx]} ${y}`;
}
