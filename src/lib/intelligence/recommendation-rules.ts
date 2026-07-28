import { formatPct } from "./kpi-explanations";
import type { RootCauseResult } from "./root-cause-engine";

export type RecommendationTier = "High" | "Moderate" | "Watch";

export interface RecommendationResult {
	action: string;
	reason: string;
	tier: RecommendationTier;
}

const LOW_CONFIDENCE_THRESHOLD = 60;
const LARGE_MOVE_THRESHOLD = 10;

/**
 * Deterministic recommendation rules over the Root Cause Engine's output —
 * genuinely new code, not a reuse of the existing action-center.ts or
 * ai/recommendation-engine.ts generators (neither is wired to root-cause
 * data; see docs/TECH_DEBT.md). No LLM, no fabricated numeric "expected
 * impact" — the tier is a qualitative signal, not a statistical prediction.
 */
export function generateRootCauseRecommendation(
	rootCause: RootCauseResult,
): RecommendationResult | null {
	const { revenue, storeContribution, topCategory, confidence } = rootCause;

	if (confidence < LOW_CONFIDENCE_THRESHOLD) {
		return {
			action:
				"Hold off on major changes until the next period confirms the trend.",
			reason:
				"Confidence is low this period — the explanation may be noisy (see factors above).",
			tier: "Watch",
		};
	}

	const worstStore = [...storeContribution].sort((a, b) => {
		const aVal =
			typeof a.revenueGrowthPct === "number" ? a.revenueGrowthPct : 0;
		const bVal =
			typeof b.revenueGrowthPct === "number" ? b.revenueGrowthPct : 0;
		return aVal - bVal;
	})[0];

	const largeMove = Math.abs(revenue.growthPct) > LARGE_MOVE_THRESHOLD;

	if (revenue.status === "Down") {
		if (revenue.primaryDriver === "bill_cuts") {
			return {
				action: worstStore
					? `Investigate footfall at ${worstStore.storeDisplayName} — consider a local promotion or marketing push.`
					: "Investigate the footfall drop — consider a local promotion or marketing push.",
				reason: `Bill cuts ${formatPct(revenue.billsGrowthPct)} is the primary driver of the ${formatPct(revenue.growthPct)} revenue move.`,
				tier: largeMove ? "High" : "Moderate",
			};
		}
		if (revenue.primaryDriver === "aov") {
			return {
				action: topCategory
					? `Review pricing/discounting in ${topCategory.category} — basket size is shrinking there.`
					: "Review recent discounting or basket composition — average order value is declining.",
				reason: `AOV ${formatPct(revenue.aovGrowthPct)} is the primary driver of the ${formatPct(revenue.growthPct)} revenue move.`,
				tier: largeMove ? "High" : "Moderate",
			};
		}
		return {
			action:
				"Both footfall and basket size are under pressure — start with the weakest store, then review category mix.",
			reason: `Bills ${formatPct(revenue.billsGrowthPct)} and AOV ${formatPct(revenue.aovGrowthPct)} are both declining.`,
			tier: largeMove ? "High" : "Moderate",
		};
	}

	if (revenue.status === "Up") {
		if (revenue.primaryDriver === "both") {
			return {
				action:
					"Growth is broad-based across footfall and basket size — continue current promotions and staffing levels.",
				reason: `Bills ${formatPct(revenue.billsGrowthPct)} and AOV ${formatPct(revenue.aovGrowthPct)} are both up.`,
				tier: "High",
			};
		}
		if (revenue.primaryDriver === "bill_cuts") {
			return {
				action:
					"Growth is driven by footfall — sustain current marketing and staffing to protect the gain.",
				reason: `Bill cuts ${formatPct(revenue.billsGrowthPct)} is the primary driver.`,
				tier: "Moderate",
			};
		}
		if (revenue.primaryDriver === "aov") {
			return {
				action: topCategory
					? `Growth is driven by basket size, led by ${topCategory.category} — reinforce the current category mix.`
					: "Growth is driven by basket size — reinforce the current category/upsell mix.",
				reason: `AOV ${formatPct(revenue.aovGrowthPct)} is the primary driver.`,
				tier: "Moderate",
			};
		}
	}

	return {
		action:
			"No single dominant driver this period — monitor next period for a clearer signal.",
		reason: "Revenue is stable or the drivers are mixed with no clear leader.",
		tier: "Watch",
	};
}
