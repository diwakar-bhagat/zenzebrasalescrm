import * as XLSX from "xlsx";

import { normalizeProductCode } from "./product-code";

/**
 * Inventory master & stock snapshot Excel parser.
 * Maps headers from the "Active Stock Pricing" file.
 */
export interface ParsedInventoryRow {
	product_key: string;
	sku_code: string;
	item_name: string;
	category: string | null;
	main_stock: number;
	smartworks_stock: number;
	klj_stock: number;
	mrp: number;
	purchase_price: number;
}

export interface InventoryParseResult {
	rows: ParsedInventoryRow[];
	quarantined: number;
	quarantine_reasons: string[];
	raw_row_count: number;
}

export const INVENTORY_COLUMN_MAP: Record<
	string,
	Array<{ alias: string; confidence: number }>
> = {
	sku_code: [
		{ alias: "code", confidence: 1.0 },
		{ alias: "sku", confidence: 1.0 },
		{ alias: "sku_code", confidence: 1.0 },
		{ alias: "item_code", confidence: 0.9 },
		{ alias: "barcode", confidence: 0.9 },
	],
	item_name: [
		{ alias: "product name", confidence: 1.0 },
		{ alias: "productname", confidence: 1.0 },
		{ alias: "name", confidence: 0.95 },
		{ alias: "item_name", confidence: 1.0 },
		{ alias: "product", confidence: 0.95 },
		{ alias: "item", confidence: 0.9 },
	],
	category: [
		{ alias: "category", confidence: 1.0 },
		{ alias: "dept", confidence: 0.9 },
		{ alias: "department", confidence: 0.9 },
	],
	main_stock: [
		{ alias: "main", confidence: 1.0 },
		{ alias: "main_stock", confidence: 1.0 },
		{ alias: "mainstock", confidence: 1.0 },
	],
	smartworks_stock: [
		{ alias: "smartworks", confidence: 1.0 },
		{ alias: "smartworks_stock", confidence: 1.0 },
		{ alias: "smartworksstock", confidence: 1.0 },
	],
	klj_stock: [
		{ alias: "klj", confidence: 1.0 },
		{ alias: "klj_stock", confidence: 1.0 },
		{ alias: "kljstock", confidence: 1.0 },
	],
	mrp: [
		{ alias: "mrp", confidence: 1.0 },
		{ alias: "mrp_price", confidence: 0.95 },
		{ alias: "retail_price", confidence: 0.9 },
	],
	purchase_price: [
		{ alias: "purchase price", confidence: 1.0 },
		{ alias: "purchase_price", confidence: 1.0 },
		{ alias: "purchaseprice", confidence: 1.0 },
		{ alias: "price", confidence: 0.85 },
		{ alias: "cost", confidence: 0.9 },
	],
};

const REQUIRED_FIELDS = ["sku_code", "item_name", "mrp", "purchase_price"];

function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[\s_-]/g, "");
}

interface ColumnMatch {
	field: string;
	matchedColumn: string;
	confidence: number;
}

export function resolveInventoryColumnMappings(
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

	for (const [field, aliases] of Object.entries(INVENTORY_COLUMN_MAP)) {
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
				`Required field '${field}' could not be matched to any column in the inventory sheet.`,
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

export function parseInventoryExcelBuffer(
	buffer: Buffer,
): InventoryParseResult {
	const workbook = XLSX.read(buffer, { type: "buffer" });
	const sheetName = workbook.SheetNames[0];
	const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

	if (!worksheet) {
		throw new Error("No worksheet found in the inventory workbook.");
	}

	const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		defval: "",
	});

	return parseInventoryRawRows(rawRows);
}

export function parseInventoryRawRows(
	rawRows: Record<string, unknown>[],
): InventoryParseResult {
	if (rawRows.length === 0) {
		return {
			rows: [],
			quarantined: 0,
			quarantine_reasons: [],
			raw_row_count: 0,
		};
	}

	const firstRow = rawRows[0];
	if (!firstRow) {
		throw new Error("No rows found in the sheet.");
	}

	const mappingResult = resolveInventoryColumnMappings(firstRow);
	if (!mappingResult.isValid) {
		throw new Error(
			`Inventory column mapping validation failed:\n- ${mappingResult.errors.join("\n- ")}`,
		);
	}

	const resolved = mappingResult.mappings;
	const skuCodeCol = resolved.sku_code?.matchedColumn;
	const itemNameCol = resolved.item_name?.matchedColumn;
	const mrpCol = resolved.mrp?.matchedColumn;
	const purchasePriceCol = resolved.purchase_price?.matchedColumn;

	if (!skuCodeCol || !itemNameCol || !mrpCol || !purchasePriceCol) {
		throw new Error(
			"Required inventory columns mapping definition is missing.",
		);
	}

	const mainStockCol = resolved.main_stock?.matchedColumn;
	const smartworksStockCol = resolved.smartworks_stock?.matchedColumn;
	const kljStockCol = resolved.klj_stock?.matchedColumn;
	const categoryCol = resolved.category?.matchedColumn;

	const rows: ParsedInventoryRow[] = [];
	const quarantine_reasons: string[] = [];
	let quarantined = 0;

	for (const raw of rawRows) {
		// Canonical code so the cost master keys match sales sku_code exactly
		// (handles scientific-notation barcodes, floats, and ".0" artifacts).
		const skuCode = normalizeProductCode(raw[skuCodeCol]) ?? "";
		const itemName = String(raw[itemNameCol] ?? "").trim();
		const mrp = Number(raw[mrpCol]);
		const purchasePrice = Number(raw[purchasePriceCol]);

		// Optional fields (rounded to integers to prevent DB type errors)
		const main_stock = mainStockCol
			? Math.round(Number(raw[mainStockCol] || 0))
			: 0;
		const smartworks_stock = smartworksStockCol
			? Math.round(Number(raw[smartworksStockCol] || 0))
			: 0;
		const klj_stock = kljStockCol
			? Math.round(Number(raw[kljStockCol] || 0))
			: 0;
		const category = categoryCol
			? String(raw[categoryCol] ?? "").trim() || null
			: null;

		// Cost master is keyed by the normalized SKU code (one authoritative price
		// per product), so it joins directly to sales_fact_v.sku_code. On duplicate
		// codes the upsert (ON CONFLICT product_key) keeps the latest price.
		const productKey = skuCode;

		const errors: string[] = [];

		if (!skuCode) {
			errors.push("Missing SKU code");
		}
		if (!itemName) {
			errors.push("Missing Product Name");
		}
		if (Number.isNaN(mrp) || mrp < 0) {
			errors.push(`Invalid MRP: ${raw[mrpCol]}`);
		}
		if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
			errors.push(`Invalid Purchase Price: ${raw[purchasePriceCol]}`);
		}

		if (errors.length > 0) {
			quarantined += 1;
			quarantine_reasons.push(
				`Row: SKU: ${skuCode || "N/A"}, Name: ${itemName || "N/A"} - Errors: ${errors.join(", ")}`,
			);
			continue;
		}

		rows.push({
			product_key: productKey,
			sku_code: skuCode,
			item_name: itemName,
			category,
			main_stock,
			smartworks_stock,
			klj_stock,
			mrp,
			purchase_price: purchasePrice,
		});
	}

	return {
		rows,
		quarantined,
		quarantine_reasons,
		raw_row_count: rawRows.length,
	};
}
