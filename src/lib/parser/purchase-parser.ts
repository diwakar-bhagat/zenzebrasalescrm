import * as XLSX from "xlsx";

/**
 * Purchase (vendor-side) Excel parser.
 *
 * Mirrors the data-cleaning rules of `excel-parser.ts` (brand trim, exact category
 * casing, DD-MM-YYYY dates, sku ?? item_name product_key priority) but maps the
 * vendor-purchase columns. Store normalization is applied later in the import
 * service via the shared store-normalizer (same as sales).
 *
 * Source column mapping (final column "net purchase" is authoritative):
 *   number       -> bill_no
 *   dateOnly     -> purchase_date
 *   billed_by    -> billed_by
 *   sku          -> sku_code
 *   name         -> item_name
 *   brand        -> brand
 *   category     -> category
 *   quantity     -> quantity
 *   net purchase -> net_purchase_amount
 *   tax          -> tax_amount
 *   gross pur    -> gross_purchase_amount
 */
export interface ParsedPurchaseRow {
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

export interface PurchaseParseResult {
	rows: ParsedPurchaseRow[];
	quarantined: number;
	quarantine_reasons: string[];
	latest_purchase_date: string;
	raw_row_count: number;
}

// Dynamic mapping configuration with confidence scores (same engine as sales parser).
export const PURCHASE_COLUMN_MAP: Record<
	string,
	Array<{ alias: string; confidence: number }>
> = {
	bill_no: [
		{ alias: "number", confidence: 1.0 },
		{ alias: "bill_no", confidence: 1.0 },
		{ alias: "bill_number", confidence: 1.0 },
		{ alias: "invoice", confidence: 0.95 },
	],
	purchase_date: [
		{ alias: "dateOnly", confidence: 1.0 },
		{ alias: "purchase_date", confidence: 1.0 },
		{ alias: "date", confidence: 0.85 },
		{ alias: "bill_date", confidence: 0.95 },
	],
	billed_by: [
		{ alias: "billed_by", confidence: 1.0 },
		{ alias: "billedBy", confidence: 1.0 },
		{ alias: "store", confidence: 0.95 },
		{ alias: "branch", confidence: 0.9 },
	],
	item_name: [
		{ alias: "name", confidence: 1.0 },
		{ alias: "item_name", confidence: 1.0 },
		{ alias: "product", confidence: 0.95 },
		{ alias: "productName", confidence: 1.0 },
		{ alias: "item", confidence: 0.9 },
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
	],
	supplier_name: [
		{ alias: "supplier", confidence: 1.0 },
		{ alias: "supplier_name", confidence: 1.0 },
		{ alias: "vendor", confidence: 0.95 },
		{ alias: "vendor_name", confidence: 0.95 },
	],
};

const REQUIRED_FIELDS = [
	"purchase_date",
	"item_name",
	"quantity",
	"net_purchase_amount",
];

function normalizeSkuCode(value: unknown): string | null {
	if (value == null || value === "") return null;
	return String(value).replace(/\.0$/, "").trim() || null;
}

function parsePurchaseDate(dateRaw: string): string | null {
	const parts = dateRaw.split("-");
	if (parts.length !== 3) return null;
	const [dd, mm, yyyy] = parts;
	if (!dd || !mm || !yyyy) return null;
	const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
	const parsed = new Date(`${iso}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	return iso;
}

function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[\s_-]/g, "");
}

interface ColumnMatch {
	field: string;
	matchedColumn: string;
	confidence: number;
}

export function resolvePurchaseColumnMappings(
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

	for (const [field, aliases] of Object.entries(PURCHASE_COLUMN_MAP)) {
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
				`Required field '${field}' could not be matched to any column in the purchase sheet.`,
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

export function parsePurchaseExcelBuffer(buffer: Buffer): PurchaseParseResult {
	const workbook = XLSX.read(buffer, { type: "buffer" });
	// Prefer a sheet named "main"; otherwise fall back to the first sheet.
	const sheetName = workbook.SheetNames.includes("main")
		? "main"
		: workbook.SheetNames[0];
	const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

	if (!worksheet) {
		throw new Error("No worksheet found in the purchase workbook.");
	}

	const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		raw: true,
		defval: null,
	});

	if (rawRows.length === 0) {
		return {
			rows: [],
			quarantined: 0,
			quarantine_reasons: [],
			latest_purchase_date: "",
			raw_row_count: 0,
		};
	}

	const firstRow = rawRows[0]!;
	const mappingResult = resolvePurchaseColumnMappings(firstRow);
	if (!mappingResult.isValid) {
		throw new Error(
			`Purchase column mapping validation failed:\n- ${mappingResult.errors.join("\n- ")}`,
		);
	}

	const resolved = mappingResult.mappings;
	const rows: ParsedPurchaseRow[] = [];
	const quarantine_reasons: string[] = [];
	let quarantined = 0;
	const dates: string[] = [];

	for (const raw of rawRows) {
		const dateRaw = String(
			raw[resolved.purchase_date!.matchedColumn] ?? "",
		).trim();
		const itemName = String(
			raw[resolved.item_name!.matchedColumn] ?? "",
		).trim();
		const quantity = Number(raw[resolved.quantity!.matchedColumn]);

		const netPurchase = Number(
			raw[resolved.net_purchase_amount!.matchedColumn],
		);

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
			? normalizeSkuCode(raw[resolved.sku_code.matchedColumn])
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
		if (Number.isNaN(quantity)) errors.push("invalid quantity");
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

		const purchaseDate = parsePurchaseDate(dateRaw);
		if (!purchaseDate) {
			quarantined++;
			quarantine_reasons.push(
				`Row (bill: ${billNo || "unknown"}): invalid date '${dateRaw}' — expected DD-MM-YYYY`,
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
