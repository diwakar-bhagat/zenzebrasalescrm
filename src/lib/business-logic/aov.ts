import { calculateGrowth, buildWhereClause } from "./comparison";

export async function getAovKpi(db: any, periods: any, filters: any) {
  const where = buildWhereClause(filters);
  const result = await (db as any).query(`
    SELECT 
      SUM(CASE WHEN ${periods.current} THEN net_amount ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN ${periods.current} THEN bill_no END), 0) as current_aov,
      SUM(CASE WHEN ${periods.previous} THEN net_amount ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN ${periods.previous} THEN bill_no END), 0) as previous_aov
    FROM sales_fact
    WHERE ${where}
  `);

  const row = result[0] || {};
  const current = parseFloat(row.current_aov || "0");
  const previous = parseFloat(row.previous_aov || "0");

  return {
    current,
    growth: calculateGrowth(current, previous) || 0
  };
}
