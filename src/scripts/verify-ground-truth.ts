import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const EXPECTED = {
  totalRows: 16136,
  distinctBills: 10065,
  totalRevenue: 1605756.36,
  totalQuantity: 19638,
  distinctMobile: 1811,
  klj: { rows: 4395, bills: 2648, revenue: 433880.54, units: 5081 },
  smart: { rows: 11741, bills: 7417, revenue: 1171875.82, units: 14557 },
  overallAov: 159.54,
  repeatCustomers: 832,
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  const sql = neon(process.env.DATABASE_URL);
  let failed = 0;

  const [totals] = await sql`
    SELECT COUNT(*)::int AS rows, COUNT(DISTINCT bill_no)::int AS bills,
      ROUND(SUM(net_amount)::numeric, 2) AS revenue, SUM(quantity)::int AS units,
      COUNT(DISTINCT customer_mobile) FILTER (WHERE customer_mobile IS NOT NULL AND customer_mobile <> '')::int AS mobiles
    FROM sales_fact_v`;

  const checks = [
    ["total rows", totals.rows, EXPECTED.totalRows],
    ["distinct bills", totals.bills, EXPECTED.distinctBills],
    ["total revenue", Number(totals.revenue), EXPECTED.totalRevenue],
    ["total quantity", totals.units, EXPECTED.totalQuantity],
    ["distinct customer_mobile", totals.mobiles, EXPECTED.distinctMobile],
  ] as const;

  for (const [label, actual, expected] of checks) {
    const ok = label.includes("revenue") ? Math.abs(Number(actual) - expected) < 1 : actual === expected;
    console.log(`${ok ? "✅" : "❌"} ${label}: ${actual} (expected ${expected})`);
    if (!ok) failed++;
  }

  for (const [store, exp] of [
    ["Klj store", EXPECTED.klj],
    ["SmartworksNoida Noida", EXPECTED.smart],
  ] as const) {
    const [row] = await sql`
      SELECT COUNT(*)::int AS rows, COUNT(DISTINCT bill_no)::int AS bills,
        ROUND(SUM(net_amount)::numeric, 2) AS revenue, SUM(quantity)::int AS units
      FROM sales_fact_v WHERE billed_by = ${store}`;
    for (const [label, actual, expected] of [
      [`${store} rows`, row.rows, exp.rows],
      [`${store} bills`, row.bills, exp.bills],
      [`${store} revenue`, Number(row.revenue), exp.revenue],
      [`${store} units`, row.units, exp.units],
    ] as const) {
      const ok = label.includes("revenue") ? Math.abs(Number(actual) - expected) < 1 : actual === expected;
      console.log(`${ok ? "✅" : "❌"} ${label}: ${actual} (expected ${expected})`);
      if (!ok) failed++;
    }
  }

  const [aovRow] = await sql`
    SELECT ROUND(SUM(net_amount) / NULLIF(COUNT(DISTINCT bill_no), 0), 2) AS aov FROM sales_fact_v`;
  const aov = Number(aovRow.aov);
  console.log(`${Math.abs(aov - EXPECTED.overallAov) < 0.1 ? "✅" : "❌"} overall AOV: ${aov} (expected ${EXPECTED.overallAov})`);
  if (Math.abs(aov - EXPECTED.overallAov) >= 0.1) failed++;

  const [repeatRow] = await sql`
    SELECT COUNT(*)::int AS repeat_customers FROM (
      SELECT customer_mobile FROM sales_fact_v
      WHERE customer_mobile IS NOT NULL AND customer_mobile <> ''
      GROUP BY customer_mobile HAVING COUNT(DISTINCT bill_no) > 1) x`;
  console.log(`${repeatRow.repeat_customers === EXPECTED.repeatCustomers ? "✅" : "❌"} repeat customers: ${repeatRow.repeat_customers} (expected ${EXPECTED.repeatCustomers})`);
  if (repeatRow.repeat_customers !== EXPECTED.repeatCustomers) failed++;

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed. Re-import ground-truth Excel with full_replace.`);
    process.exit(1);
  }
  console.log("\nAll ground-truth metrics passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
