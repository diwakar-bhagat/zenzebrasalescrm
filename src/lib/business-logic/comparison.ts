import type { DashboardFilters } from "@/lib/founder/types";

export interface ComparisonPeriods {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  label: string;
}

export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseISODate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function isFullMonth(start: Date, end: Date) {
  const firstDay = start.getUTCDate() === 1;
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  return firstDay && end.getUTCDate() === lastDay && start.getUTCMonth() === end.getUTCMonth();
}

export function getComparisonPeriods(filters: Pick<DashboardFilters, "startDate" | "endDate">): ComparisonPeriods {
  const currentStart = parseISODate(filters.startDate);
  const currentEnd = parseISODate(filters.endDate);

  if (currentStart > currentEnd) {
    throw new Error("startDate must be before or equal to endDate.");
  }

  if (isFullMonth(currentStart, currentEnd)) {
    const previousStart = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() - 1, 1));
    const previousEnd = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth(), 0));

    return {
      currentStart: toISODate(currentStart),
      currentEnd: toISODate(currentEnd),
      previousStart: toISODate(previousStart),
      previousEnd: toISODate(previousEnd),
      label: "vs previous month",
    };
  }

  const days = Math.round((currentEnd.getTime() - currentStart.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);

  return {
    currentStart: toISODate(currentStart),
    currentEnd: toISODate(currentEnd),
    previousStart: toISODate(previousStart),
    previousEnd: toISODate(previousEnd),
    label: days === 1 ? "vs previous day" : `vs previous ${days} days`,
  };
}

export function cleanDashboardFilters(filters: DashboardFilters): DashboardFilters {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    store: filters.store?.trim() || undefined,
    category: filters.category?.trim() || undefined,
    brand: filters.brand?.trim() || undefined,
    sku: filters.sku?.trim() || undefined,
  };
}
