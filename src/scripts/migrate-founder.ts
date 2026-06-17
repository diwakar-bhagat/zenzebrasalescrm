import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local for local scripts
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in environment.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = neon(process.env.DATABASE_URL);

  console.log("Creating upload_batches table...");
  await sql`
    CREATE TABLE IF NOT EXISTS upload_batches (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      valid_row_count INTEGER NOT NULL DEFAULT 0,
      quarantined_row_count INTEGER NOT NULL DEFAULT 0,
      date_range_start DATE,
      date_range_end DATE,
      uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  console.log("Ensuring upload_batches columns...");
  await sql`ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS valid_row_count INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS quarantined_row_count INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS date_range_start DATE;`;
  await sql`ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS date_range_end DATE;`;

  console.log("Creating sales_fact table...");
  await sql`
    CREATE TABLE IF NOT EXISTS sales_fact (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER REFERENCES upload_batches(id) ON DELETE CASCADE,
      sale_date DATE NOT NULL,
      bill_no TEXT NOT NULL,
      store TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      net_amount NUMERIC(12, 2) NOT NULL,
      customer_id TEXT,
      row_number INTEGER NOT NULL
    );
  `;

  console.log("Creating indexes...");
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_batch_id ON sales_fact (batch_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_sale_date ON sales_fact (sale_date);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_store ON sales_fact (store);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_category ON sales_fact (category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_brand ON sales_fact (brand);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_sku ON sales_fact (sku);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_bill_no ON sales_fact (bill_no);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_date_bill_sku ON sales_fact (sale_date, bill_no, sku);`;

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
