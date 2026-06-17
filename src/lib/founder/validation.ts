import { ValidationResult, UploadRowError } from "./types";

export function validateCanonicalSheet(rows: any[]): ValidationResult {
  const errors: UploadRowError[] = [];
  const parsedData: any[] = [];
  
  if (!rows || rows.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      errorCount: 1,
      errors: [{ rowNumber: 0, errors: ["Sheet is empty."] }]
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // Assuming row 1 is header
    const rowErrors: string[] = [];

    // Check required fields
    const requiredFields = ['sale_date', 'bill_no', 'store', 'category', 'brand', 'sku', 'product_name', 'quantity', 'net_amount'];
    for (const field of requiredFields) {
      if (row[field] === undefined || row[field] === null || row[field] === "") {
        rowErrors.push(`Missing required field: ${field}`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, errors: rowErrors });
      continue;
    }

    // Validate Date
    // Excel dates might come as numbers or strings depending on xlsx parsing
    // Assuming xlsx is configured to return parsed strings or numbers
    const dateStr = String(row['sale_date']);
    // naive check for YYYY-MM-DD or valid date
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      rowErrors.push(`Invalid sale_date format: ${dateStr}`);
    }

    // Validate Quantity
    const qty = Number(row['quantity']);
    if (isNaN(qty) || qty <= 0) {
      rowErrors.push(`Quantity must be a positive number, got: ${row['quantity']}`);
    }

    // Validate Net Amount
    const net = Number(row['net_amount']);
    if (isNaN(net) || net < 0) {
      rowErrors.push(`net_amount cannot be negative, got: ${row['net_amount']}`);
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, errors: rowErrors });
    } else {
      parsedData.push({
        sale_date: parsedDate.toISOString().split('T')[0],
        bill_no: String(row['bill_no']),
        store: String(row['store']),
        category: String(row['category']),
        brand: String(row['brand']),
        sku: String(row['sku']),
        product_name: String(row['product_name']),
        quantity: qty,
        net_amount: net,
        customer_id: row['customer_id'] ? String(row['customer_id']) : null,
        row_number: rowNumber
      });
    }
  }

  return {
    isValid: errors.length === 0,
    totalRows: rows.length,
    errorCount: errors.length,
    errors,
    parsedData: errors.length === 0 ? parsedData : undefined
  };
}
