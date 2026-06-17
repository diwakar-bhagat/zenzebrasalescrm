import * as xlsx from "xlsx";

import type { CanonicalSalesRow, UploadRowError, ValidationResult } from "./types";

const REQUIRED_FIELDS = [
  "sale_date",
  "bill_no",
  "store",
  "category",
  "brand",
  "sku",
  "product_name",
  "quantity",
  "net_amount",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  amount: "net_amount",
  bill_number: "bill_no",
  bill_no: "bill_no",
  bill: "bill_no",
  invoice: "bill_no",
  invoice_no: "bill_no",
  invoice_number: "bill_no",
  receipt: "bill_no",
  store: "store",
  location: "store",
  branch: "store",
  billed_by: "store",
  company: "store",
  category_name: "category",
  date: "sale_date",
  item: "product_name",
  item_name: "product_name",
  product: "product_name",
  product_name: "product_name",
  description: "product_name",
  item_description: "product_name",
  name: "product_name",
  net_amount: "net_amount",
  net_sales: "net_amount",
  total: "net_amount",
  total_amount: "net_amount",
  grand_total: "net_amount",
  value: "net_amount",
  qty: "quantity",
  quantity: "quantity",
  sale_date: "sale_date",
  sales_date: "sale_date",
  sku: "sku",
};

function normalizeHeader(header: string) {
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return HEADER_ALIASES[normalized] ?? normalized;
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});
}

function toRequiredText(value: unknown) {
  return String(value ?? "").trim();
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  return Number(cleaned);
}

function parseSaleDate(value: unknown): string | null {
  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashDate) {
    const [, day, month, rawYear] = slashDate;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function validateCanonicalSheet(rows: Record<string, unknown>[]): ValidationResult {
  const errors: UploadRowError[] = [];
  const validData: CanonicalSalesRow[] = [];

  if (!rows.length) {
    return {
      isValid: false,
      totalRows: 0,
      validRows: 0,
      errorCount: 1,
      errors: [{ rowNumber: 0, errors: ["Sheet is empty."] }],
      validData,
      dateRange: { start: null, end: null },
      parsedData: validData,
    };
  }

  const normalizedRows = rows.map(normalizeRow);
  const headers = new Set(Object.keys(normalizedRows[0] ?? {}));
  const missingHeaders = REQUIRED_FIELDS.filter((field) => !headers.has(field));

  if (missingHeaders.length > 0) {
    return {
      isValid: false,
      totalRows: rows.length,
      validRows: 0,
      errorCount: 1,
      errors: [{ rowNumber: 1, errors: [`Missing required headers: ${missingHeaders.join(", ")}`] }],
      validData,
      dateRange: { start: null, end: null },
      parsedData: validData,
    };
  }

  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const rowNumber = i + 2;
    const rowErrors: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (toRequiredText(row[field]) === "") {
        rowErrors.push(`Missing required field: ${field}`);
      }
    }

    const saleDate = parseSaleDate(row.sale_date);
    if (!saleDate) rowErrors.push(`Invalid sale_date format: ${String(row.sale_date ?? "")}`);

    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      rowErrors.push(`Quantity must be a positive whole number, got: ${String(row.quantity ?? "")}`);
    }

    const netAmount = parseMoney(row.net_amount);
    if (!Number.isFinite(netAmount) || netAmount < 0) {
      rowErrors.push(`net_amount cannot be negative or invalid, got: ${String(row.net_amount ?? "")}`);
    }

    if (rowErrors.length > 0 || !saleDate) {
      errors.push({ rowNumber, errors: rowErrors });
      continue;
    }

    validData.push({
      sale_date: saleDate,
      bill_no: toRequiredText(row.bill_no),
      store: toRequiredText(row.store),
      category: toRequiredText(row.category),
      brand: toRequiredText(row.brand),
      sku: toRequiredText(row.sku),
      product_name: toRequiredText(row.product_name),
      quantity,
      net_amount: netAmount,
      customer_id: toRequiredText(row.customer_id) || null,
      row_number: rowNumber,
    });
  }

  const dates = validData.map((row) => row.sale_date).sort();

  return {
    isValid: validData.length > 0,
    totalRows: rows.length,
    validRows: validData.length,
    errorCount: errors.length,
    errors,
    validData,
    dateRange: {
      start: dates[0] ?? null,
      end: dates.at(-1) ?? null,
    },
    parsedData: validData,
  };
}
