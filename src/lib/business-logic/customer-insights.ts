import type {
	CustomerConcentrationResult,
	CustomerInsight,
	InsightTone,
	RevenueCompositionResult,
	ValueDistributionResult,
} from "@/types/customer-intelligence";

export interface InsightInputs {
	composition: RevenueCompositionResult;
	distribution: ValueDistributionResult;
	concentration: CustomerConcentrationResult;
	month1RetentionPct: number | null;
}

const TONE_RANK: Record<InsightTone, number> = {
	critical: 0,
	warning: 1,
	positive: 2,
	neutral: 3,
};

/**
 * Dynamic insight engine — generates founder-facing diagnoses by combining
 * signals across revenue composition, retention, concentration, and value
 * distribution. All interpretation lives here (never in React).
 */
export function buildCustomerInsights(
	inputs: InsightInputs,
): CustomerInsight[] {
	const { composition, distribution, concentration, month1RetentionPct } =
		inputs;
	const insights: CustomerInsight[] = [];

	const repeat = composition.cards.find((c) => c.key === "repeat");
	const fresh = composition.cards.find((c) => c.key === "new");
	const anon = composition.cards.find((c) => c.key === "anonymous");
	const repeatGrowth = repeat?.revenueGrowthPct ?? null;
	const newGrowth = fresh?.revenueGrowthPct ?? null;

	// 1. Mix + retention interplay.
	if (repeatGrowth !== null && newGrowth !== null) {
		if (repeatGrowth < 0 && newGrowth > 0) {
			insights.push({
				id: "acquisition-healthy-retention-weak",
				title: "Acquisition healthy, retention weak",
				detail: `New revenue is up ${fmt(newGrowth)} but repeat revenue fell ${fmt(
					repeatGrowth,
				)}. You are refilling a leaky bucket — invest in retention.`,
				tone: "warning",
			});
		} else if (repeatGrowth > 0 && newGrowth < 0) {
			insights.push({
				id: "loyalty-driving-growth",
				title: "Loyalty is driving growth",
				detail: `Repeat revenue rose ${fmt(repeatGrowth)} while new revenue fell ${fmt(
					newGrowth,
				)}. Existing customers are compounding — protect them and reopen acquisition.`,
				tone: repeatGrowth > 0 ? "positive" : "neutral",
			});
		} else if (repeatGrowth < 0 && newGrowth < 0) {
			insights.push({
				id: "revenue-softening",
				title: "Revenue softening on both fronts",
				detail: `Both repeat (${fmt(repeatGrowth)}) and new (${fmt(
					newGrowth,
				)}) revenue declined. Diagnose footfall and product mix urgently.`,
				tone: "critical",
			});
		} else if (repeatGrowth > 0 && newGrowth > 0) {
			insights.push({
				id: "balanced-growth",
				title: "Balanced growth",
				detail: `Repeat (${fmt(repeatGrowth)}) and new (${fmt(
					newGrowth,
				)}) revenue are both up — acquisition and loyalty are compounding together.`,
				tone: "positive",
			});
		}
	}

	// 2. VIP-driven growth warning.
	if (
		repeatGrowth !== null &&
		repeatGrowth > 0 &&
		month1RetentionPct !== null &&
		month1RetentionPct < 30
	) {
		insights.push({
			id: "vip-driven-growth",
			title: "Few VIP customers driving growth",
			detail: `Repeat revenue is up ${fmt(
				repeatGrowth,
			)} yet month-1 retention is only ${month1RetentionPct}%. A small loyal core is carrying growth — broaden retention.`,
			tone: "warning",
		});
	}

	// 3. Anonymous revenue.
	if (anon && anon.revenuePct >= 25) {
		insights.push({
			id: "anonymous-revenue-high",
			title: "High anonymous revenue",
			detail: `${anon.revenuePct}% of revenue comes from unidentified customers. Capture mobile numbers at billing to unlock retention and LTV.`,
			tone: anon.revenuePct >= 40 ? "critical" : "warning",
		});
	}

	// 4. Revenue at risk / concentration.
	const risk = concentration.revenueAtRisk;
	if (risk.revenueSharePct >= 25 && risk.topCustomerCount > 0) {
		insights.push({
			id: "revenue-at-risk",
			title: "Revenue concentrated in few customers",
			detail: `Your top ${risk.topCustomerCount} customers drive ${risk.revenueSharePct}% of revenue. Losing a handful would materially dent the business — build loyalty safeguards.`,
			tone: risk.revenueSharePct >= 40 ? "critical" : "warning",
		});
	}

	// 5. One-and-done customers.
	const once = distribution.rows.find(
		(r) => r.minVisits === 1 && !r.isOpenEnded,
	);
	if (once && once.customerSharePct >= 60) {
		insights.push({
			id: "one-and-done",
			title: "Most customers buy only once",
			detail: `${once.customerSharePct}% of customers purchase once (${once.revenueSharePct}% of revenue). A second-purchase nudge is the highest-leverage retention move.`,
			tone: "warning",
		});
	}

	return insights.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}

function fmt(pct: number): string {
	return `${pct >= 0 ? "+" : ""}${pct}%`;
}
