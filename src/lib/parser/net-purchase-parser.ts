import * as XLSX from "xlsx";

import { normalizeProductCode } from "./product-code";

/**
 * Net Purchase Excel parser — completely independent from the Sales and
 * Inventory parsers. This module parses the finance team's Net Purchase
 * ledger spreadsheet.
 *
 * It does NOT require any Sales fields (bill_no, sale_date, billed_by,
 * gross_amount, net_amount from sales context).
 * It does NOT require any Inventory fields (purchase_price, mrp, stock_quantity).
 *
 * Source column mapping (dynamic alias resolution):
 *   number / bill_no      → bill_no
 *   date / purchase_date  → purchase_date
 *   billed_by / store     → billed_by
 *   sku / code            → sku_code
 *   name / item_name      → item_name
 *   brand                 → brand
 *   category / dept       → category
 *   quantity / qty        → quantity
 *   net purchase / total  → net_purchase_amount
 *   tax / gst             → tax_amount
 *   gross pur / gross     → gross_purchase_amount
 *   supplier / vendor     → supplier_name
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface ParsedNetPurchaseRow {
	bill_no: string | null;
	purchase_date: string;
	billed_by: string;
	product_key: string;
	sku_code: string | null;
	item_name: string;
	brand: string | null;
	category: string | null;
	quantity: number;
	gross_purchase_amount: number;
	tax_amount: number;
	net_purchase_amount: number;
	supplier_name: string | null;
	source_billed_by?: string;
	store_id?: number;
}

export interface NetPurchaseParseResult {
	rows: ParsedNetPurchaseRow[];
	quarantined: number;
	quarantine_reasons: string[];
	latest_purchase_date: string;
	raw_row_count: number;
}

// ── Column Mapping ───────────────────────────────────────────────────────

export const NET_PURCHASE_COLUMN_MAP: Record<
	string,
	Array<{ alias: string; confidence: number }>
> = {
	bill_no: [
		{ alias: "number", confidence: 1.0 },
		{ alias: "bill_no", confidence: 1.0 },
		{ alias: "bill_number", confidence: 1.0 },
		{ alias: "invoice", confidence: 0.95 },
		{ alias: "invoice_no", confidence: 0.95 },
		{ alias: "voucher", confidence: 0.9 },
	],
	purchase_date: [
		{ alias: "dateOnly", confidence: 1.0 },
		{ alias: "purchase_date", confidence: 1.0 },
		{ alias: "date", confidence: 0.85 },
		{ alias: "bill_date", confidence: 0.95 },
		{ alias: "invoice_date", confidence: 0.95 },
	],
	billed_by: [
		{ alias: "billed_by", confidence: 1.0 },
		{ alias: "billedBy", confidence: 1.0 },
		{ alias: "store", confidence: 0.95 },
		{ alias: "branch", confidence: 0.9 },
		{ alias: "location", confidence: 0.85 },
	],
	item_name: [
		{ alias: "name", confidence: 1.0 },
		{ alias: "item_name", confidence: 1.0 },
		{ alias: "product", confidence: 0.95 },
		{ alias: "productName", confidence: 1.0 },
		{ alias: "item", confidence: 0.9 },
		{ alias: "description", confidence: 0.85 },
	],
	sku_code: [
		{ alias: "sku", confidence: 1.0 },
		{ alias: "sku_code", confidence: 1.0 },
		{ alias: "code", confidence: 0.9 },
		{ alias: "barcode", confidence: 0.9 },
		{ alias: "item_code", confidence: 0.9 },
	],
	brand: [{ alias: "brand", confidence: 1.0 }],
	category: [
		{ alias: "category", confidence: 1.0 },
		{ alias: "dept", confidence: 0.9 },
		{ alias: "department", confidence: 0.9 },
	],
	quantity: [
		{ alias: "quantity", confidence: 1.0 },
		{ alias: "qty", confidence: 0.95 },
	],
	net_purchase_amount: [
		{ alias: "net purchase", confidence: 1.0 },
		{ alias: "net_purchase", confidence: 1.0 },
		{ alias: "netpurchase", confidence: 1.0 },
		{ alias: "net_purchase_amount", confidence: 1.0 },
		{ alias: "net amount", confidence: 0.9 },
		{ alias: "net_amount", confidence: 0.9 },
		{ alias: "total", confidence: 0.8 },
		{ alias: "amount", confidence: 0.75 },
	],
	tax_amount: [
		{ alias: "tax", confidence: 1.0 },
		{ alias: "tax_amount", confidence: 1.0 },
		{ alias: "totalTax", confidence: 0.95 },
		{ alias: "gst", confidence: 0.9 },
	],
	gross_purchase_amount: [
		{ alias: "gross pur", confidence: 1.0 },
		{ alias: "gross_pur", confidence: 1.0 },
		{ alias: "grosspur", confidence: 1.0 },
		{ alias: "gross_purchase", confidence: 1.0 },
		{ alias: "gross", confidence: 0.85 },
		{ alias: "gross_amount", confidence: 0.95 },
	],
	supplier_name: [
		{ alias: "supplier", confidence: 1.0 },
		{ alias: "supplier_name", confidence: 1.0 },
		{ alias: "vendor", confidence: 0.95 },
		{ alias: "vendor_name", confidence: 0.95 },
		{ alias: "party", confidence: 0.85 },
	],
};

const REQUIRED_FIELDS = ["purchase_date", "item_name", "net_purchase_amount"];

// ── Date Parsing ─────────────────────────────────────────────────────────

function isValidIso(iso: string): boolean {
	return !Number.isNaN(new Date(`${iso}T00:00:00.000Z`).getTime());
}

/**
 * Parse a purchase date from any of the formats this pipeline sees:
 *   • Excel serial number (raw:true cells, e.g. 45678)
 *   • ISO `YYYY-MM-DD` (optionally with a time component)
 *   • `DD-MM-YYYY` or `DD/MM/YYYY`
 * Returns ISO `YYYY-MM-DD` or null. Never timezone-shifts.
 */
function parseNetPurchaseDate(raw: unknown): string | null {
	if (raw === null || raw === undefined || raw === "") return null;

	// Excel serial number (or numeric string in the plausible serial range).
	const asNum =
		typeof raw === "number"
			? raw
			: /^\d+(\.\d+)?$/.test(String(raw).trim())
				? Number(String(raw).trim())
				: NaN;
	if (!Number.isNaN(asNum) && asNum > 20000 && asNum < 80000) {
		const d = XLSX.SSF.parse_date_code(asNum);
		if (d?.y) {
			return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
		}
	}

	const s = String(raw).trim();

	// ISO YYYY-MM-DD (with optional time / "T").
	const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) {
		const v = `${iso[1]}-${iso[2]}-${iso[3]}`;
		return isValidIso(v) ? v : null;
	}

	// DD-MM-YYYY or DD/MM/YYYY.
	const parts = s.split(/[-/]/);
	if (parts.length === 3) {
		const [dd, mm, yyyy] = parts;
		if (dd && mm && yyyy && yyyy.length === 4) {
			const v = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
			return isValidIso(v) ? v : null;
		}
	}
	return null;
}

// ── Header Normalization ─────────────────────────────────────────────────

function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[\s_-]/g, "");
}

interface ColumnMatch {
	field: string;
	matchedColumn: string;
	confidence: number;
}

// ── Public API ───────────────────────────────────────────────────────────

export function resolveNetPurchaseColumnMappings(
	firstRow: Record<string, unknown>,
): {
	mappings: Record<string, ColumnMatch>;
	isValid: boolean;
	errors: string[];
} {
	const resolved: Record<string, ColumnMatch> = {};
	const rowHeaders = Object.keys(firstRow);
	const errors: string[] = [];
	let isValid = true;

	for (const [field, aliases] of Object.entries(NET_PURCHASE_COLUMN_MAP)) {
		let bestMatch: ColumnMatch | null = null;
		for (const item of aliases) {
			const normAlias = normalizeHeader(item.alias);
			const matchedHeader = rowHeaders.find(
				(h) => normalizeHeader(h) === normAlias,
			);
			if (matchedHeader) {
				if (!bestMatch || item.confidence > bestMatch.confidence) {
					bestMatch = {
						field,
						matchedColumn: matchedHeader,
						confidence: item.confidence,
					};
				}
			}
		}

		if (bestMatch) {
			resolved[field] = bestMatch;
		} else if (REQUIRED_FIELDS.includes(field)) {
			isValid = false;
			errors.push(
				`Required field '${field}' could not be matched to any column in the net purchase sheet.`,
			);
		}
	}

	for (const field of REQUIRED_FIELDS) {
		const match = resolved[field];
		if (match && match.confidence < 0.9) {
			isValid = false;
			errors.push(
				`Required field '${field}' matched column '${match.matchedColumn}' but confidence was only ${(match.confidence * 100).toFixed(0)}% (minimum 90%).`,
			);
		}
	}

	return { mappings: resolved, isValid, errors };
}

export function parseNetPurchaseExcelBuffer(
	buffer: Buffer,
): NetPurchaseParseResult {
	const workbook = XLSX.read(buffer, { type: "buffer" });
	const sheetName = workbook.SheetNames.includes("main")
		? "main"
		: workbook.SheetNames[0];
	const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

	if (!worksheet) {
		throw new Error("No worksheet found in the net purchase workbook.");
	}

	const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		raw: true,
		defval: null,
	});

	return parseNetPurchaseRawRows(rawRows);
}

export function parseNetPurchaseRawRows(
	rawRows: Record<string, unknown>[],
): NetPurchaseParseResult {
	if (rawRows.length === 0) {
		return {
			rows: [],
			quarantined: 0,
			quarantine_reasons: [],
			latest_purchase_date: "",
			raw_row_count: 0,
		};
	}

	const firstRow = rawRows[0];
	if (!firstRow) {
		throw new Error("No rows found in the sheet.");
	}
	const mappingResult = resolveNetPurchaseColumnMappings(firstRow);
	if (!mappingResult.isValid) {
		throw new Error(
			`Net Purchase column mapping validation failed:\n- ${mappingResult.errors.join("\n- ")}`,
		);
	}

	const resolved = mappingResult.mappings;
	const purchaseDateCol = resolved.purchase_date?.matchedColumn;
	const itemNameCol = resolved.item_name?.matchedColumn;
	const netPurchaseCol = resolved.net_purchase_amount?.matchedColumn;

	if (!purchaseDateCol || !itemNameCol || !netPurchaseCol) {
		throw new Error(
			"Required net purchase columns mapping definition is missing.",
		);
	}

	// quantity is optional in a finance ledger — default to 1 when absent.
	const quantityCol = resolved.quantity?.matchedColumn;

	const rows: ParsedNetPurchaseRow[] = [];
	const quarantine_reasons: string[] = [];
	let quarantined = 0;
	const dates: string[] = [];

	for (const raw of rawRows) {
		const dateCell = raw[purchaseDateCol];
		const dateRaw = String(dateCell ?? "").trim();
		const itemName = String(raw[itemNameCol] ?? "").trim();
		const netPurchase = Number(raw[netPurchaseCol]);

		// Quantity defaults to 1 when not present in the sheet.
		const quantity = quantityCol
			? Number.isNaN(Number(raw[quantityCol]))
				? 1
				: Number(raw[quantityCol])
			: 1;

		// Tax with fallback (derive from gross - net when possible).
		let taxAmount = resolved.tax_amount
			? Number(raw[resolved.tax_amount.matchedColumn])
			: NaN;

		let grossPurchase = resolved.gross_purchase_amount
			? Number(raw[resolved.gross_purchase_amount.matchedColumn])
			: NaN;

		if (Number.isNaN(grossPurchase)) {
			grossPurchase = Number.isNaN(taxAmount)
				? netPurchase
				: netPurchase + taxAmount;
		}
		if (Number.isNaN(taxAmount)) {
			taxAmount = grossPurchase - netPurchase;
		}

		const billNo = resolved.bill_no
			? String(raw[resolved.bill_no.matchedColumn] ?? "").trim() || null
			: null;
		const billedBy = resolved.billed_by
			? String(raw[resolved.billed_by.matchedColumn] ?? "").trim()
			: "";
		const skuCode = resolved.sku_code
			? normalizeProductCode(raw[resolved.sku_code.matchedColumn])
			: null;
		const brand = resolved.brand
			? String(raw[resolved.brand.matchedColumn] ?? "").trim() || null
			: null;
		const category = resolved.category
			? String(raw[resolved.category.matchedColumn] ?? "").trim() || null
			: null;
		const supplierName = resolved.supplier_name
			? String(raw[resolved.supplier_name.matchedColumn] ?? "").trim() || null
			: null;

		// Product identity priority: sku_code ?? item_name (never empty/null).
		const productKey = skuCode || itemName;

		const errors: string[] = [];
		if (!dateRaw) errors.push("missing purchase_date");
		if (!itemName) errors.push("missing item_name");
		if (Number.isNaN(netPurchase)) errors.push("invalid net_purchase_amount");
		if (Number.isNaN(taxAmount)) errors.push("invalid tax_amount");
		if (Number.isNaN(grossPurchase))
			errors.push("invalid gross_purchase_amount");

		if (errors.length > 0) {
			quarantined++;
			quarantine_reasons.push(
				`Row (bill: ${billNo || "unknown"}): ${errors.join(", ")}`,
			);
			continue;
		}

		const purchaseDate = parseNetPurchaseDate(dateCell);
		if (!purchaseDate) {
			quarantined++;
			quarantine_reasons.push(
				`Row (bill: ${billNo || "unknown"}): invalid date '${dateRaw}' — expected ISO, Excel serial, or DD-MM-YYYY`,
			);
			continue;
		}

		dates.push(purchaseDate);
		rows.push({
			bill_no: billNo,
			purchase_date: purchaseDate,
			billed_by: billedBy,
			product_key: productKey,
			sku_code: skuCode,
			item_name: itemName,
			brand,
			category,
			quantity,
			gross_purchase_amount: grossPurchase,
			tax_amount: taxAmount,
			net_purchase_amount: netPurchase,
			supplier_name: supplierName,
		});
	}

	const latestPurchaseDate = [...dates].sort().at(-1) ?? "";

	return {
		rows,
		quarantined,
		quarantine_reasons,
		latest_purchase_date: latestPurchaseDate,
		raw_row_count: rawRows.length,
	};
}
