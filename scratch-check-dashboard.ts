import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sql } from "./src/lib/db";

async function checkDashboardData() {
  console.log("=== Dashboard DB Inspection ===");
  try {
    const [salesCount] = await sql`SELECT count(*)::int as count, min(sale_date)::text as min_date, max(sale_date)::text as max_date FROM sales_fact`;
    console.log("sales_fact table:", salesCount);

    const [viewCount] = await sql`SELECT count(*)::int as count, min(sale_date)::text as min_date, max(sale_date)::text as max_date FROM sales_fact_v`;
    console.log("sales_fact_v view:", viewCount);

    const stores = await sql`SELECT DISTINCT billed_by FROM sales_fact_v`;
    console.log("Stores in sales_fact_v:", stores.map(s => s.billed_by));

    const recentSales = await sql`SELECT sale_date::text, bill_no, billed_by, net_amount FROM sales_fact ORDER BY sale_date DESC LIMIT 5`;
    console.log("Recent 5 sales:", recentSales);

  } catch (err) {
    console.error("Error connecting or querying DB:", err);
  }
}

checkDashboardData();
