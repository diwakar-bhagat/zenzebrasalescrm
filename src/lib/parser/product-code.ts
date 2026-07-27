/**
 * Canonical product-code normalization — the single place a SKU/barcode `code`
 * is cleaned, so sales, inventory (cost master), and profitability joins all key
 * on an identical value.
 *
 * The classic failure this prevents: barcodes read from Excel as floats in
 * scientific notation (`8.901262151696E12`) never matching the same barcode read
 * as a plain integer (`8901262151696`). Always normalize both sides before joins.
 *
 * Barcodes (~13 digits ≈ 9e12) are well within Number's safe integer range
 * (2^53 ≈ 9e15), so numeric coercion is lossless here.
 */
export function normalizeProductCode(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" && value.trim() === "") return null;

	const n = Number(value);
	if (!Number.isNaN(n) && Number.isFinite(n)) {
		// Whole number (incl. scientific-notation like 8.9E12) → full integer string.
		if (Number.isInteger(n)) return String(n);
		// Non-integer numeric code → consistent trimmed form.
		return String(n);
	}

	// Non-numeric code → trimmed string, drop a trailing ".0" artifact.
	return String(value).trim().replace(/\.0$/, "") || null;
}
