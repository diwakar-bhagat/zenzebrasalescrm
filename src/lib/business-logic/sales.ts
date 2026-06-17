import { calculateGrowth, buildWhereClause } from "./comparison";

export async function getSalesKpis(db: any, periods: any, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT 
      SUM(CASE WHEN ${periods.current} THEN amount ELSE 0 END) as current_revenue,
      SUM(CASE WHEN ${periods.previous} THEN amount ELSE 0 END) as previous_revenue,
      COUNT(DISTINCT CASE WHEN ${periods.current} THEN bill_no END) as current_bills,
      COUNT(DISTINCT CASE WHEN ${periods.previous} THEN bill_no END) as previous_bills,
      SUM(CASE WHEN ${periods.current} THEN quantity ELSE 0 END) as current_qty,
      SUM(CASE WHEN ${periods.previous} THEN quantity ELSE 0 END) as previous_qty
    FROM sales_fact
    WHERE ${where}
  `);

  const row = result[0] || {};
  const currentRevenue = parseFloat(row.current_revenue || "0");
  const previousRevenue = parseFloat(row.previous_revenue || "0");
  const currentBills = parseInt(row.current_bills || "0");
  const previousBills = parseInt(row.previous_bills || "0");
  const currentQty = parseInt(row.current_qty || "0");
  const previousQty = parseInt(row.previous_qty || "0");

  return {
    revenue: {
      current: currentRevenue,
      growth: calculateGrowth(currentRevenue, previousRevenue) || 0
    },
    billCuts: {
      current: currentBills,
      growth: calculateGrowth(currentBills, previousBills) || 0
    },
    unitsSold: {
      current: currentQty,
      growth: calculateGrowth(currentQty, previousQty) || 0
    }
  };
}

export async function getCategoryPerformance(db: any, currentPeriod: string, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT category, SUM(amount) as revenue
    FROM sales_fact
    WHERE ${currentPeriod} AND ${where}
    GROUP BY category
    ORDER BY revenue DESC
    LIMIT 5
  `);
  return result.map((r: any) => ({ category: r.category || 'Unknown', revenue: parseFloat(r.revenue || 0) }));
}

export async function getProductPerformance(db: any, currentPeriod: string, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT item, SUM(quantity) as quantity, SUM(amount) as revenue
    FROM sales_fact
    WHERE ${currentPeriod} AND ${where}
    GROUP BY item
    ORDER BY quantity DESC
    LIMIT 10
  `);
  return result.map((r: any) => ({ 
    item: r.item || 'Unknown', 
    quantity: parseInt(r.quantity || 0),
    revenue: parseFloat(r.revenue || 0)
  }));
}
