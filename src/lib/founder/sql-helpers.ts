export function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatINR(amount: number): string {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function buildWhereClause(filters: {
  store?: string;
  category?: string;
  brand?: string;
  sku?: string;
  dateRange?: string;
}): string {
  const conditions: string[] = [];
  if (filters.store && filters.store !== "All Stores") conditions.push(`store = '${filters.store.replace(/'/g, "''")}'`);
  if (filters.category && filters.category !== "All Categories") conditions.push(`category = '${filters.category.replace(/'/g, "''")}'`);
  if (filters.brand && filters.brand !== "All Brands") conditions.push(`brand = '${filters.brand.replace(/'/g, "''")}'`);
  if (filters.sku) conditions.push(`sku ILIKE '%${filters.sku.replace(/'/g, "''")}%'`);
  if (filters.dateRange) conditions.push(filters.dateRange);

  if (conditions.length === 0) return "1=1";
  return conditions.join(" AND ");
}

export function getComparisonPeriods(days: number) {
  return {
    current: `date >= CURRENT_DATE - INTERVAL '${days} days'`,
    previous: `date >= CURRENT_DATE - INTERVAL '${days * 2} days' AND date < CURRENT_DATE - INTERVAL '${days} days'`
  };
}

export async function getDailyHealth(db: any, periods: any, filters: any) {
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
  const currentRev = parseFloat(row.current_revenue || "0");
  const prevRev = parseFloat(row.previous_revenue || "0");
  const currentBills = parseInt(row.current_bills || "0");
  const prevBills = parseInt(row.previous_bills || "0");
  const currentQty = parseInt(row.current_qty || "0");
  const prevQty = parseInt(row.previous_qty || "0");

  return {
    currentRevenue: currentRev,
    revenueGrowth: calculateGrowth(currentRev, prevRev) || 0,
    currentBills,
    billsGrowth: calculateGrowth(currentBills, prevBills) || 0,
    currentQuantity: currentQty,
    quantityGrowth: calculateGrowth(currentQty, prevQty) || 0,
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

export async function getBrandPerformance(db: any, currentPeriod: string, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT brand, SUM(amount) as revenue
    FROM sales_fact
    WHERE ${currentPeriod} AND ${where}
    GROUP BY brand
    ORDER BY revenue DESC
    LIMIT 5
  `);
  return result.map((r: any) => ({ brand: r.brand || 'Unknown', revenue: parseFloat(r.revenue || 0) }));
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

export async function getBillCutAnalysis(db: any, currentPeriod: string, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT date, COUNT(DISTINCT bill_no) as bills
    FROM sales_fact
    WHERE ${currentPeriod} AND ${where}
    GROUP BY date
    ORDER BY date ASC
  `);
  return result.map((r: any) => ({ 
    date: r.date, 
    bills: parseInt(r.bills || 0) 
  }));
}

export async function getAovAnalysis(db: any, periods: any, filters: any) {
  const where = buildWhereClause(filters);
  const result = await db(`
    SELECT 
      SUM(CASE WHEN ${periods.current} THEN amount ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN ${periods.current} THEN bill_no END), 0) as current_aov,
      SUM(CASE WHEN ${periods.previous} THEN amount ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN ${periods.previous} THEN bill_no END), 0) as previous_aov
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
