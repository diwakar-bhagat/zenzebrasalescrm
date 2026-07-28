import type { RevenueDriverResult } from "@/lib/business-logic/revenue-driver";
import type { RootCauseResult } from "./root-cause-engine";
import type { StoreDiagnosticRow } from "./store-diagnostics";

export function formatPct(value: number | null): string {
	if (value === null) return "flat";
	return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export interface BillsExplanationInput {
	revenueDriver: RevenueDriverResult;
	dailyHealth: Array<{ metric: string; growth: number | null }>;
	customerIntelligence: { repeatCustomers: number; newCustomers: number };
	storeDiagnostics: StoreDiagnosticRow[];
}

export interface StoreMixRow {
	billedBy: string;
	storeDisplayName: string;
	billCutsGrowthPct: number | "NEW STORE";
}

export interface BillsExplanation {
	growthPct: number | null;
	customerGrowthPct: number | null;
	repeatCustomers: number;
	newCustomers: number;
	storeMix: StoreMixRow[];
	explanation: string;
}

/**
 * Composes a Bills explanation from data /api/sales/dashboard already fetches
 * — no new SQL. "Peak Hours" is intentionally not included: sales_fact_v (the
 * view every query reads) doesn't expose a time-of-day column, so that signal
 * isn't buildable without new SQL (tracked in docs/TECH_DEBT.md, TD-002).
 */
export function buildBillsExplanation(
	input: BillsExplanationInput,
): BillsExplanation {
	const { revenueDriver, dailyHealth, customerIntelligence, storeDiagnostics } =
		input;

	const customerGrowthPct =
		dailyHealth.find((row) => row.metric === "Customers")?.growth ?? null;

	const storeMix: StoreMixRow[] = storeDiagnostics.map((row) => ({
		billedBy: row.billedBy,
		storeDisplayName: row.name,
		billCutsGrowthPct: row.performance.billCuts.growth,
	}));

	const growthPct = revenueDriver.billCutsGrowthPct;
	const explanation = `Bill cuts ${formatPct(growthPct)}, customer count ${formatPct(customerGrowthPct)} — ${customerIntelligence.repeatCustomers.toLocaleString()} repeat and ${customerIntelligence.newCustomers.toLocaleString()} new customers this period.`;

	return {
		growthPct,
		customerGrowthPct,
		repeatCustomers: customerIntelligence.repeatCustomers,
		newCustomers: customerIntelligence.newCustomers,
		storeMix,
		explanation,
	};
}

// ---------------------------------------------------------------------------
// AOV
// ---------------------------------------------------------------------------

export interface AovExplanationInput {
	revenueDriver: RevenueDriverResult;
	topCategory: RootCauseResult["topCategory"];
	topCustomers: Array<{
		customerMobile: string;
		customerName: string | null;
		revenue: number;
	}>;
}

export interface AovExplanation {
	growthPct: number | null;
	topCategory: RootCauseResult["topCategory"];
	topCustomers: Array<{ label: string; revenue: number }>;
	explanation: string;
}

/**
 * Composes an AOV explanation from data already fetched by /api/sales/dashboard
 * — no new SQL. topCategory is reused from the Root Cause Engine's output
 * (not recomputed). "Premium Products"/"Bundles" are intentionally not
 * included: no such concept exists anywhere in the codebase today (tracked in
 * docs/TECH_DEBT.md, TD-002).
 */
export function buildAovExplanation(
	input: AovExplanationInput,
): AovExplanation {
	const { revenueDriver, topCategory, topCustomers } = input;

	const growthPct = revenueDriver.aovGrowthPct;
	const topCategoryText = topCategory
		? `${topCategory.category} (${formatPct(topCategory.aovGrowthPct)} AOV)`
		: "no single category stands out";

	return {
		growthPct,
		topCategory,
		topCustomers: topCustomers.slice(0, 3).map((c) => ({
			label: c.customerName ?? c.customerMobile,
			revenue: c.revenue,
		})),
		explanation: `Average order value ${formatPct(growthPct)} — largest category shift: ${topCategoryText}.`,
	};
}
