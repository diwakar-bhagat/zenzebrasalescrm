import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sql } from "./src/lib/db";
import { getValueDistribution } from "./src/lib/business-logic/customer-value-distribution";

async function run() {
  const periods = {
    currentStart: "2025-09-16",
    currentEnd: "2026-07-04",
    previousStart: "2025-08-16",
    previousEnd: "2025-09-15"
  };
  const filters = {
    store: null,
    category: null,
    brand: null,
    sku: null,
    categoryScope: "all"
  };
  
  try {
    const resMv = await getValueDistribution(sql, periods as any, filters as any, true);
    console.log("=== Value Distribution Calculated from MV ===");
    console.log(JSON.stringify(resMv.rows, null, 2));
  } catch (err) {
    console.error("Error calculating value distribution:", err);
  }
}

run();
