import type { RevenueDriverResult } from "@/lib/business-logic/revenue-driver";
import type { StoreDiagnosticRow } from "./store-diagnostics";

interface BrandPerformanceRow {
	brand: string;
	currentUnits: number;
	currentRevenue: number;
	prevUnits: number;
	prevRevenue: number;
	unitsGrowthPct: number | null;
}

interface SkuPerformanceRow {
	skuCode: string | null;
	itemName: string;
	brand: string | null;
	category: string | null;
	currentUnits: number;
	currentRevenue: number;
	prevUnits: number;
	unitsGrowthPct: number | null;
}

interface CategoryBillCutsRow {
	category: string;
	currentBillCuts: number;
	currentUnits: number;
	prevBillCuts: number;
	prevUnits: number;
	billCutsGrowthPct: number | null;
	unitsGrowthPct: number | null;
}

interface CategoryAovRow {
	category: string;
	currentAov: number;
	currentRevenue: number;
	currentBillCuts: number;
	prevAov: number;
	aovGrowthPct: number | null;
}

export interface RootCauseInput {
	revenueDriver: RevenueDriverResult;
	storeDiagnostics: StoreDiagnosticRow[];
	brandPerformance: BrandPerformanceRow[];
	skuPerformance: SkuPerformanceRow[];
	categoryBillCuts: CategoryBillCutsRow[];
	categoryAov: CategoryAovRow[];
	totalBillCuts: number;
}

export interface StoreContribution {
	billedBy: string;
	storeDisplayName: string;
	revenueGrowthPct: number | "NEW STORE";
	diagnosisType: string;
	diagnosisMessage: string;
	owner: string;
	priority: string;
}

export interface RootCauseResult {
	revenue: {
		status: "Up" | "Down" | "Stable";
		growthPct: number;
		primaryDriver: "bill_cuts" | "aov" | "both" | "flat";
		explanation: string;
		billsGrowthPct: number | null;
		aovGrowthPct: number | null;
	};
	storeContribution: StoreContribution[];
	topCategory: {
		category: string;
		billCutsGrowthPct: number | null;
		aovGrowthPct: number | null;
	} | null;
	topBrand: {
		brand: string;
		currentRevenue: number;
		unitsGrowthPct: number | null;
	} | null;
	topSku: {
		skuCode: string | null;
		itemName: string;
		currentRevenue: number;
		unitsGrowthPct: number | null;
	} | null;
	confidence: number;
	confidenceFactors: string[];
}

const LOW_SAMPLE_BILL_THRESHOLD = 50;

/**
 * Composes the Root Cause explanation from already-computed business-logic
 * outputs — a pure function with no DB access, same pattern as
 * computeRevenueDriver/diagnoseStore. No new calculations: revenue math comes
 * from computeRevenueDriver, store diagnosis from getStoreDiagnostics
 * (diagnoseStore + getStoreAovBillsHistory), and category/brand/SKU movers are
 * picked from arrays the caller already fetched — this function only sorts and
 * selects, it never recomputes a metric.
 */
export function buildRootCause(input: RootCauseInput): RootCauseResult {
	const {
		revenueDriver,
		storeDiagnostics,
		brandPerformance,
		skuPerformance,
		categoryBillCuts,
		categoryAov,
		totalBillCuts,
	} = input;

	// --- Store contribution: sort by |growth| descending. Stores flagged
	// "NEW STORE" have no comparable prior period, so they're excluded from the
	// ranking (pushed to the end) rather than treated as a 0% change.
	const storeContribution: StoreContribution[] = [...storeDiagnostics]
		.sort((a, b) => {
			const aIsNew = a.performance.revenue.growth === "NEW STORE";
			const bIsNew = b.performance.revenue.growth === "NEW STORE";
			if (aIsNew && !bIsNew) return 1;
			if (bIsNew && !aIsNew) return -1;
			return Math.abs(b.growth) - Math.abs(a.growth);
		})
		.map((row) => ({
			billedBy: row.billedBy,
			storeDisplayName: row.name,
			revenueGrowthPct: row.performance.revenue.growth,
			diagnosisType: row.diagnosis.type,
			diagnosisMessage: row.diagnosis.message,
			owner: row.diagnosis.owner,
			priority: row.diagnosis.priority,
		}));

	// --- Top category mover: getCategoryBillCuts/getCategoryAov are sorted by
	// current absolute value, not movement. Re-sort the already-fetched rows by
	// |billCutsGrowthPct| to find which category actually moved the most.
	const topCategoryRow = [...categoryBillCuts]
		.filter((row) => row.billCutsGrowthPct !== null)
		.sort(
			(a, b) =>
				Math.abs(b.billCutsGrowthPct ?? 0) - Math.abs(a.billCutsGrowthPct ?? 0),
		)[0];
	const topCategoryAov = topCategoryRow
		? categoryAov.find((row) => row.category === topCategoryRow.category)
		: undefined;
	const topCategory = topCategoryRow
		? {
				category: topCategoryRow.category,
				billCutsGrowthPct: topCategoryRow.billCutsGrowthPct,
				aovGrowthPct: topCategoryAov?.aovGrowthPct ?? null,
			}
		: null;

	// --- Top brand/SKU mover: both arrays are already SQL-sorted by
	// abs(unit change) DESC, so the top mover is already the first row —
	// selection only, no re-sort needed.
	const topBrandRow = brandPerformance[0];
	const topBrand = topBrandRow
		? {
				brand: topBrandRow.brand,
				currentRevenue: topBrandRow.currentRevenue,
				unitsGrowthPct: topBrandRow.unitsGrowthPct,
			}
		: null;

	const topSkuRow = skuPerformance[0];
	const topSku = topSkuRow
		? {
				skuCode: topSkuRow.skuCode,
				itemName: topSkuRow.itemName,
				currentRevenue: topSkuRow.currentRevenue,
				unitsGrowthPct: topSkuRow.unitsGrowthPct,
			}
		: null;

	// --- Confidence: a transparent heuristic about how much to trust this
	// explanation, NOT a business metric. Starts at 100, deducted for known
	// sources of noise. Documented here so every deduction is visible.
	let confidence = 100;
	const confidenceFactors: string[] = [];

	const newStoreCount = storeDiagnostics.filter(
		(row) => row.performance.revenue.growth === "NEW STORE",
	).length;
	if (newStoreCount > 0) {
		confidence -= 15;
		confidenceFactors.push(
			`${newStoreCount} store${newStoreCount > 1 ? "s" : ""} too new to compare — excluded from the growth ranking.`,
		);
	}

	if (totalBillCuts < LOW_SAMPLE_BILL_THRESHOLD) {
		confidence -= 20;
		confidenceFactors.push(
			`Only ${totalBillCuts} bills in this period — the explanation may be noisy at this sample size.`,
		);
	}

	const topStore = storeContribution[0];
	if (
		topStore &&
		typeof topStore.revenueGrowthPct === "number" &&
		revenueDriver.revenueGrowth !== 0
	) {
		const topStoreSign = Math.sign(topStore.revenueGrowthPct);
		const overallSign = Math.sign(revenueDriver.revenueGrowth);
		if (
			topStoreSign !== 0 &&
			overallSign !== 0 &&
			topStoreSign !== overallSign
		) {
			confidence -= 15;
			confidenceFactors.push(
				`${topStore.storeDisplayName}'s direction differs from overall revenue trend — worth investigating further.`,
			);
		}
	}

	confidence = Math.max(0, Math.min(100, confidence));

	return {
		revenue: {
			status: revenueDriver.revenueStatus,
			growthPct: revenueDriver.revenueGrowth,
			primaryDriver: revenueDriver.primaryDriver,
			explanation: revenueDriver.explanation,
			billsGrowthPct: revenueDriver.billCutsGrowthPct,
			aovGrowthPct: revenueDriver.aovGrowthPct,
		},
		storeContribution,
		topCategory,
		topBrand,
		topSku,
		confidence,
		confidenceFactors,
	};
}
