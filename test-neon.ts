import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
	try {
		// Step 1: Check for NULLs in key columns
		console.log("Checking for NULL values in key columns...");
		const nullCheck = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE sale_date IS NULL)::int AS null_sale_date,
        COUNT(*) FILTER (WHERE bill_no IS NULL OR bill_no = '')::int AS null_bill_no,
        COUNT(*) FILTER (WHERE store IS NULL OR store = '')::int AS null_store,
        COUNT(*) FILTER (WHERE sku IS NULL OR sku = '')::int AS null_sku,
        COUNT(*)::int AS total_rows
      FROM sales_fact
    `;
		console.log("NULL counts:", nullCheck[0]);

		// Step 2: Check duplicates (COALESCE-safe)
		console.log("\nChecking for duplicates...");
		const dupes = await sql`
      SELECT 
        COALESCE(sale_date::text, 'NULL') AS sale_date,
        COALESCE(bill_no, 'NULL') AS bill_no,
        COALESCE(store, 'NULL') AS store,
        COALESCE(sku, 'NULL') AS sku,
        COUNT(*)::int AS cnt
      FROM sales_fact
      GROUP BY 1, 2, 3, 4
      HAVING COUNT(*) > 1
      LIMIT 10
    `;

		if (dupes.length > 0) {
			console.log(
				`⚠️  Found ${dupes.length} duplicate groups. Deduplicating...`,
			);
			console.table(dupes);

			// Step 3: Deduplicate — keep only the row with the highest id
			const deleted = await sql`
        DELETE FROM sales_fact sf
        WHERE sf.id NOT IN (
          SELECT MAX(id)
          FROM sales_fact
          GROUP BY sale_date, bill_no, store, COALESCE(sku, '')
        )
      `;
			console.log("Deduplication complete.");
		} else {
			console.log("✅  No duplicates found.");
		}

		// Step 4: Add unique constraint
		console.log("\nAdding unique constraint...");
		await sql`
      ALTER TABLE sales_fact
      ADD CONSTRAINT uq_sales_fact_key
      UNIQUE (sale_date, bill_no, store, sku)
    `;
		console.log("✅  Constraint uq_sales_fact_key added successfully.");

		// Step 5: Verify
		const verify = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'sales_fact'
        AND constraint_name = 'uq_sales_fact_key'
    `;
		console.log("Constraint verified:", verify);
	} catch (e: any) {
		if (e.message?.includes("already exists")) {
			console.log("ℹ️  Constraint uq_sales_fact_key already exists — OK.");
		} else {
			console.error("Error:", e.message ?? e);
		}
	}
}
main();
