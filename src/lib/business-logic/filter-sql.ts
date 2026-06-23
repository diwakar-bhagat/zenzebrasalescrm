import type { DashboardFilters } from "@/lib/founder/types";

export const FOOD_CATEGORIES = ["LIVE MENU", "SNACK CORNER", "BEVERAGES"] as const;

export const STORE_OPTIONS = [
  { billedBy: "Klj store", displayName: "KLJ" },
  { billedBy: "SmartworksNoida Noida", displayName: "Smart Works Noida" },
] as const;

export function retailCategoryClause(categoryScope?: DashboardFilters["categoryScope"]) {
  if (categoryScope !== "retail") return null;
  return FOOD_CATEGORIES;
}
