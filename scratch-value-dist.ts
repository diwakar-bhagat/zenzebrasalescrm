import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sql } from "./src/lib/db";
import { getValueDistribution } from "./src/lib/business-logic/customer-value-distribution";

async function run() {
  const periods = {
    currentStart: "2025-09-16",
    currentEnd: "2026-07-04",
    compareStart: "2025-08-16",
    compareEnd: "2025-09-15"
  };
  const filters = {
    store: null,
    category: null,
    brand: null,
    sku: null,
    categoryScope: "all"
  };
  
  try {
    const res = await getValueDistribution(sql, periods as any, filters as any, false);
    console.log("=== Value Distribution Calculated from Live DB ===");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error calculating value distribution:", err);
  }
}

run();
