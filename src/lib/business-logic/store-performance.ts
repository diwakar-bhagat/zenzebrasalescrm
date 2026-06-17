import { calculateGrowth, buildWhereClause } from "./comparison";

export async function getStorePerformance(db: any, periods: any, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT 
      store,
      SUM(CASE WHEN ${periods.current} THEN net_amount ELSE 0 END) as current_revenue,
      SUM(CASE WHEN ${periods.previous} THEN net_amount ELSE 0 END) as previous_revenue,
      COUNT(DISTINCT CASE WHEN ${periods.current} THEN bill_no END) as current_bills,
      COUNT(DISTINCT CASE WHEN ${periods.previous} THEN bill_no END) as previous_bills,
      SUM(CASE WHEN ${periods.current} THEN quantity ELSE 0 END) as current_qty,
      SUM(CASE WHEN ${periods.previous} THEN quantity ELSE 0 END) as previous_qty
    FROM sales_fact
    WHERE ${where} AND store IS NOT NULL
    GROUP BY store
    ORDER BY current_revenue DESC
  `);

  let totalRevenue = 0;
  
  const parsedResult = result.map((r: any) => {
    const rev = parseFloat(r.current_revenue || "0");
    totalRevenue += rev;
    
    return {
      store: r.store,
      revenue: rev,
      revenueGrowth: calculateGrowth(rev, parseFloat(r.previous_revenue || "0")) || 0,
      billCuts: parseInt(r.current_bills || "0"),
      billCutsGrowth: calculateGrowth(parseInt(r.current_bills || "0"), parseInt(r.previous_bills || "0")) || 0,
      units: parseInt(r.current_qty || "0"),
      aov: rev / Math.max(1, parseInt(r.current_bills || "0")),
    };
  });

  // Calculate contribution %
  return parsedResult.map((store: any) => ({
    ...store,
    contributionPercent: totalRevenue > 0 ? (store.revenue / totalRevenue) * 100 : 0
  }));
}
