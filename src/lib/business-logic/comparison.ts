/**
 * Core Business Math for Comparisons.
 * No UI logic allowed here.
 */

export function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function getComparisonPeriods(days: number) {
  // Today -> Yesterday
  // Last 7 -> Previous 7
  // Last 30 -> Previous 30
  // Everything is relative to the provided number of days.
  return {
    current: `sale_date >= CURRENT_DATE - INTERVAL '${days} days'`,
    previous: `sale_date >= CURRENT_DATE - INTERVAL '${days * 2} days' AND sale_date < CURRENT_DATE - INTERVAL '${days} days'`
  };
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
