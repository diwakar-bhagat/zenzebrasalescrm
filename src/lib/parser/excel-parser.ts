import * as XLSX from "xlsx";

export const STORE_WHITELIST = ["SmartworksNoida Noida", "Klj store"] as const;
export type StoreWhitelistValue = (typeof STORE_WHITELIST)[number];

const REQUIRED_COLUMNS = [
  "number",
  "dateOnly",
  "billed_by",
  "name",
  "quantity",
  "taxableAmount",
] as const;

export interface ParsedRow {
  bill_no: string;
  sale_date: string;
  billed_by: string;
  sku_code: string | null;
  item_name: string;
  brand: string | null;
  category: string | null;
  quantity: number;
  net_amount: number;
  discount_amount: number;
  customer_mobile: string | null;
  customer_name: string | null;
  payment_method: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  quarantined: number;
  quarantine_reasons: string[];
  latest_sale_date: string;
  raw_row_count: number;
}

function normalizeMobile(value: unknown): string | null {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(/\.0$/, "").trim();
  return normalized || null;
}

function normalizeSkuCode(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value).replace(/\.0$/, "").trim() || null;
}

function parseSaleDate(dateRaw: string): string | null {
  const parts = dateRaw.split("-");
  if (parts.length !== 3) return null;

  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;

  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return iso;
}

export function parseExcelBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const worksheet = workbook.Sheets.main;

  if (!worksheet) {
    throw new Error("Sheet 'main' not found. Expected one sheet named 'main'.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: true,
    defval: null,
  });

  if (rawRows.length > 0) {
    const firstRow = rawRows[0];
    const missing = REQUIRED_COLUMNS.filter((column) => !(column in firstRow));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(", ")}. Check spreadsheet format.`);
    }
  }

  const rows: ParsedRow[] = [];
  const quarantine_reasons: string[] = [];
  let quarantined = 0;
  const dates: string[] = [];

  for (const raw of rawRows) {
    const billedBy = String(raw.billed_by ?? "").trim();
    if (!STORE_WHITELIST.includes(billedBy as StoreWhitelistValue)) {
      continue;
    }

    const billNo = String(raw.number ?? "").trim();
    const dateRaw = String(raw.dateOnly ?? "").trim();
    const itemName = String(raw.name ?? "").trim();
    const quantity = Number(raw.quantity);
    const netAmount = Number(raw.taxableAmount);

    const errors: string[] = [];
    if (!billNo) errors.push("missing bill_no");
    if (!dateRaw) errors.push("missing dateOnly");
    if (!itemName) errors.push("missing item_name");
    if (Number.isNaN(quantity)) errors.push("invalid quantity");
    if (Number.isNaN(netAmount)) errors.push("invalid taxableAmount");

    if (errors.length > 0) {
      quarantined++;
      quarantine_reasons.push(`Row (bill: ${billNo || "unknown"}): ${errors.join(", ")}`);
      continue;
    }

    const saleDate = parseSaleDate(dateRaw);
    if (!saleDate) {
      quarantined++;
      quarantine_reasons.push(`Row (bill: ${billNo}): invalid date format '${dateRaw}' — expected DD-MM-YYYY`);
      continue;
    }

    const currentSalePrice = Number(raw.currentSalePrice ?? 0);
    const salePrice = Number(raw.salePrice ?? 0);
    const discountAmount = Math.max(0, (currentSalePrice - salePrice) * quantity);

    dates.push(saleDate);
    rows.push({
      bill_no: billNo,
      sale_date: saleDate,
      billed_by: billedBy,
      sku_code: normalizeSkuCode(raw.code),
      item_name: itemName,
      brand: raw.brand != null ? String(raw.brand).trim() || null : null,
      category: raw.category != null ? String(raw.category).trim() || null : null,
      quantity,
      net_amount: netAmount,
      discount_amount: discountAmount,
      customer_mobile: normalizeMobile(raw.customerMobile),
      customer_name: raw.customerName != null ? String(raw.customerName).trim() || null : null,
      payment_method: raw.paymentMethod != null ? String(raw.paymentMethod).trim() || null : null,
    });
  }

  const latestSaleDate = [...dates].sort().at(-1) ?? "";

  return {
    rows,
    quarantined,
    quarantine_reasons,
    latest_sale_date: latestSaleDate,
    raw_row_count: rawRows.length,
  };
}

export function parseResultToValidation(parseResult: ParseResult) {
  const dates = parseResult.rows.map((row) => row.sale_date).sort();
  return {
    isValid: parseResult.rows.length > 0,
    totalRows: parseResult.raw_row_count,
    validRows: parseResult.rows.length,
    errorCount: parseResult.quarantined,
    errors: parseResult.quarantine_reasons.map((reason, index) => ({
      rowNumber: index + 1,
      errors: [reason],
    })),
    validData: parseResult.rows,
    dateRange: {
      start: dates[0] ?? null,
      end: dates.at(-1) ?? null,
    },
    latestSaleDate: parseResult.latest_sale_date,
    quarantineReasons: parseResult.quarantine_reasons,
  };
}
