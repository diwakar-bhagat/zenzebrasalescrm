import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sql } from "./src/lib/db";

async function diagnoseSkus() {
  console.log("━━━ Deep Diagnostic: Unmatched SKUs & Cost Leakage ━━━\n");
  
  try {
    // 1. Total sales overview
    const [salesStats] = await sql`
      SELECT 
        COUNT(*)::int AS total_lines,
        COUNT(DISTINCT sku_code)::int AS total_skus,
        COALESCE(SUM(net_amount), 0)::numeric AS total_revenue
      FROM sales_fact
    `;
    
    // 2. Unmatched sales overview
    const [unmatchedStats] = await sql`
      SELECT 
        COUNT(*)::int AS unmatched_lines,
        COUNT(DISTINCT sf.sku_code)::int AS unmatched_skus,
        COALESCE(SUM(sf.net_amount), 0)::numeric AS unmatched_revenue
      FROM sales_fact sf
      LEFT JOIN product_master pm ON sf.sku_code = pm.sku_code
      WHERE pm.sku_code IS NULL
    `;
    
    const totalRev = Number(salesStats.total_revenue);
    const unmatchedRev = Number(unmatchedStats.unmatched_revenue);
    const revenueCoveragePct = ((totalRev - unmatchedRev) / totalRev) * 100;
    const lineCoveragePct = ((salesStats.total_lines - unmatchedStats.unmatched_lines) / salesStats.total_lines) * 100;
    const skuCoveragePct = ((salesStats.total_skus - unmatchedStats.unmatched_skus) / salesStats.total_skus) * 100;

    console.log(`  Total Sales Lines: ${salesStats.total_lines}`);
    console.log(`  Total Distinct SKUs Sold: ${salesStats.total_skus}`);
    console.log(`  Total Revenue: ₹${totalRev.toLocaleString("en-IN")}\n`);
    
    console.log(`  ❌ Unmatched Sales Lines: ${unmatchedStats.unmatched_lines} (${(100 - lineCoveragePct).toFixed(2)}% leakage)`);
    console.log(`  ❌ Unmatched SKUs: ${unmatchedStats.unmatched_skus} (${(100 - skuCoveragePct).toFixed(2)}% leakage)`);
    console.log(`  ❌ Unmatched Revenue: ₹${unmatchedRev.toLocaleString("en-IN")} (${(100 - revenueCoveragePct).toFixed(2)}% leakage)`);
    console.log(`  ✅ Ex-tax COGS Financial Coverage: ${revenueCoveragePct.toFixed(2)}% of total revenue\n`);

    // 3. Top 15 unmatched SKUs by revenue impact
    const topUnmatched = await sql`
      SELECT 
        sf.sku_code,
        sf.item_name,
        sf.brand,
        sf.category,
        COUNT(*)::int AS transactions,
        SUM(sf.quantity)::int AS units_sold,
        COALESCE(SUM(sf.net_amount), 0)::numeric AS revenue
      FROM sales_fact sf
      LEFT JOIN product_master pm ON sf.sku_code = pm.sku_code
      WHERE pm.sku_code IS NULL
      GROUP BY sf.sku_code, sf.item_name, sf.brand, sf.category
      ORDER BY revenue DESC
      LIMIT 15
    `;

    console.log("  Top 15 Unmatched SKUs by Revenue Impact:");
    console.table(
      topUnmatched.map((r, i) => ({
        Rank: i + 1,
        SKU: r.sku_code,
        Name: r.item_name.length > 30 ? r.item_name.slice(0, 28) + "..." : r.item_name,
        Brand: r.brand,
        Category: r.category,
        Units: r.units_sold,
        Revenue: `₹${Number(r.revenue).toLocaleString("en-IN")}`
      }))
    );
    
    // 4. Duplicate sales bills verification (bills with identical timestamp, customer and amount)
    const duplicateBills = await sql`
      WITH bill_totals AS (
        SELECT 
          bill_no, 
          sale_date, 
          billed_by,
          customer_mobile, 
          SUM(net_amount) AS bill_revenue,
          COUNT(*) AS sku_count
        FROM sales_fact
        GROUP BY bill_no, sale_date, billed_by, customer_mobile
      )
      SELECT 
        bill_no, 
        sale_date,
        billed_by,
        bill_revenue,
        COUNT(*) AS duplicates
      FROM bill_totals
      GROUP BY bill_no, sale_date, billed_by, bill_revenue
      HAVING COUNT(*) > 1
      ORDER BY duplicates DESC
      LIMIT 5
    `;
    
    console.log("\n  Bill Number Duplicates Check:");
    if (duplicateBills.length > 0) {
      console.log(`  ⚠️ Found duplicate bills in sales_fact!`);
      console.table(duplicateBills);
    } else {
      console.log("  ✅ No duplicate bill definitions found (integrity holds).");
    }

  } catch (err) {
    console.error("Diagnostic error:", err);
  }
}

diagnoseSkus();
