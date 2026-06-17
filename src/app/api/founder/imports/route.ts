import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as xlsx from "xlsx";
import { validateCanonicalSheet } from "@/lib/founder/validation";

export async function GET() {
  try {
    const batches = await sql`
      SELECT id, filename, status, row_count as "rowCount", error_count as "errorCount", uploaded_at as "uploadedAt"
      FROM upload_batches
      ORDER BY uploaded_at DESC
    `;
    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error("GET /imports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("mode") || "validate"; // 'validate' | 'commit'

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // We expect the first row to be headers
    // use raw: false to get formatted strings for dates if they are formatted in excel, 
    // or raw: true to handle numbers directly. We'll rely on our validation.
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const validationResult = validateCanonicalSheet(rows);

    if (mode === "validate") {
      return NextResponse.json({ validation: validationResult });
    }

    if (mode === "commit") {
      if (!validationResult.isValid || !validationResult.parsedData) {
        return NextResponse.json({ 
          error: "Validation failed. Cannot commit.", 
          validation: validationResult 
        }, { status: 400 });
      }

      // Insert into upload_batches
      const batchRes = await sql`
        INSERT INTO upload_batches (filename, status, row_count, error_count)
        VALUES (${file.name}, 'success', ${validationResult.totalRows}, ${validationResult.errorCount})
        RETURNING id
      `;
      const batchId = batchRes[0].id;

      const data = validationResult.parsedData;
      
      // Batch insert into sales_fact
      // Split into chunks if large, but we'll try UNNEST for simplicity
      const chunkSize = 1000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        const batchIds = chunk.map(() => batchId);
        const saleDates = chunk.map(c => c.sale_date);
        const billNos = chunk.map(c => c.bill_no);
        const stores = chunk.map(c => c.store);
        const cats = chunk.map(c => c.category);
        const brnds = chunk.map(c => c.brand);
        const skus = chunk.map(c => c.sku);
        const prods = chunk.map(c => c.product_name);
        const qtys = chunk.map(c => c.quantity);
        const nets = chunk.map(c => c.net_amount);
        const custs = chunk.map(c => c.customer_id);
        const rowNums = chunk.map(c => c.row_number);

        await sql`
          INSERT INTO sales_fact (batch_id, sale_date, bill_no, store, category, brand, sku, product_name, quantity, net_amount, customer_id, row_number)
          SELECT * FROM UNNEST (
            ${batchIds}::integer[],
            ${saleDates}::date[],
            ${billNos}::text[],
            ${stores}::text[],
            ${cats}::text[],
            ${brnds}::text[],
            ${skus}::text[],
            ${prods}::text[],
            ${qtys}::integer[],
            ${nets}::numeric[],
            ${custs}::text[],
            ${rowNums}::integer[]
          )
        `;
      }

      return NextResponse.json({ success: true, batchId });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  } catch (error: any) {
    console.error("POST /imports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
