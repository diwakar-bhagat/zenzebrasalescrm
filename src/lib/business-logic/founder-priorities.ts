import type {
	CustomerConcentrationResult,
	CustomerSnapshot,
	FounderPriority,
	IdentityConfidenceResult,
	RevenueCompositionResult,
	RevenueQualityScore,
	ValueDistributionResult,
} from "@/types/customer-intelligence";

import { roundTo } from "./safe-math";

const LEVEL_RANK: Record<FounderPriority["level"], number> = {
	high: 0,
	medium: 1,
	good: 2,
};

export interface PriorityInputs {
	composition: RevenueCompositionResult;
	concentration: CustomerConcentrationResult;
	identity: IdentityConfidenceResult;
	quality: RevenueQualityScore;
	month1RetentionPct: number | null;
}

/** Compact ₹ label (lakh/crore) for stakes shown on priority cards. */
function inr(n: number): string {
	if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
	if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
	if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
	return `₹${Math.round(n)}`;
}

/**
 * Daily Founder Priorities — the "what should I do this morning?" layer.
 * Turns customer signals into ranked, owned, quantified actions. Pure function;
 * extensible as store/inventory/finance signals are wired in. All interpretation
 * lives here, never in React.
 */
export function buildFounderPriorities(
	inputs: PriorityInputs,
): FounderPriority[] {
	const { composition, concentration, identity, quality, month1RetentionPct } =
		inputs;
	const priorities: FounderPriority[] = [];

	const repeat = composition.cards.find((c) => c.key === "repeat");
	const fresh = composition.cards.find((c) => c.key === "new");
	const anon = composition.cards.find((c) => c.key === "anonymous");

	// Anonymous revenue — data-capture opportunity with a concrete ₹ stake.
	if (anon && anon.revenuePct >= 20) {
		priorities.push({
			id: "anonymous-capture",
			level: anon.revenuePct >= 30 ? "high" : "medium",
			title: `${anon.revenuePct}% of revenue is from unknown customers`,
			detail:
				"Capture mobile numbers at billing to unlock retention, LTV, and targeting.",
			owner: "Operations / Marketing",
			metric: `${inr(anon.revenue)} untracked`,
		});
	}

	// Retention weakness.
	if (month1RetentionPct !== null && month1RetentionPct < 30) {
		priorities.push({
			id: "retention-weak",
			level: month1RetentionPct < 20 ? "high" : "medium",
			title: `Month-1 retention is only ${month1RetentionPct}%`,
			detail:
				"Most first-time buyers don't return next month. Launch a second-purchase nudge.",
			owner: "Marketing",
		});
	}

	// Revenue concentration / at-risk whales.
	const risk = concentration.revenueAtRisk;
	if (risk.revenueSharePct >= 25 && risk.topCustomerCount > 0) {
		priorities.push({
			id: "revenue-at-risk",
			level: risk.revenueSharePct >= 40 ? "high" : "medium",
			title: `Top ${risk.topCustomerCount} customers drive ${risk.revenueSharePct}% of revenue`,
			detail:
				"Heavy dependence on a few buyers. Protect them with loyalty and proactive outreach.",
			owner: "Founder / Marketing",
			metric: `${inr(risk.revenue)} at risk`,
		});
	}

	// Acquisition vs loyalty momentum.
	if (repeat?.revenueGrowthPct != null && fresh?.revenueGrowthPct != null) {
		if (repeat.revenueGrowthPct < 0 && fresh.revenueGrowthPct > 0) {
			priorities.push({
				id: "leaky-bucket",
				level: "high",
				title: "Repeat revenue is falling while new revenue rises",
				detail: `Repeat ${fmt(repeat.revenueGrowthPct)}, new ${fmt(fresh.revenueGrowthPct)} — you're refilling a leaky bucket.`,
				owner: "Marketing",
			});
		} else if (repeat.revenueGrowthPct > 0) {
			priorities.push({
				id: "repeat-growing",
				level: "good",
				title: `Repeat revenue is growing (${fmt(repeat.revenueGrowthPct)})`,
				detail: "Loyal customers are compounding — keep protecting the base.",
				owner: "Marketing",
			});
		}
	}

	// Identity capture win (positive) when mobile coverage is strong.
	const mobile = identity.rows.find((r) => r.source === "mobile");
	if (mobile && mobile.revenuePct >= 70) {
		priorities.push({
			id: "identity-strong",
			level: "good",
			title: `${mobile.revenuePct}% of revenue is from identified customers`,
			detail: "Strong data capture — retention and targeting are well-fuelled.",
			owner: "Operations",
		});
	}

	// Overall health signal as a closing positive/negative.
	if (quality.band === "Excellent" || quality.band === "Healthy") {
		priorities.push({
			id: "health-good",
			level: "good",
			title: `Customer health is ${quality.band.toLowerCase()} (${quality.score}/100)`,
			detail: quality.headline,
			owner: "Founder",
		});
	}

	return priorities.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

function fmt(pct: number): string {
	return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * The 5-second identity card of the business — assembled from already-computed
 * engine results (no extra query).
 */
export function buildCustomerSnapshot(
	composition: RevenueCompositionResult,
	distribution: ValueDistributionResult,
	concentration: CustomerConcentrationResult,
	quality: RevenueQualityScore,
	month1RetentionPct: number | null,
): CustomerSnapshot {
	const repeat = composition.cards.find((c) => c.key === "repeat");
	const fresh = composition.cards.find((c) => c.key === "new");
	const anon = composition.cards.find((c) => c.key === "anonymous");
	const vipBand = concentration.pareto.find((b) => b.topPct === 10);

	return {
		customers: distribution.totals.customers,
		health: { score: quality.score, band: quality.band, stars: quality.stars },
		repeatRevenuePct: repeat?.revenuePct ?? 0,
		newRevenuePct: fresh?.revenuePct ?? 0,
		month1RetentionPct,
		anonymousRevenuePct: anon?.revenuePct ?? 0,
		ltv: quality.metrics.ltv,
		aov: quality.metrics.aov,
		vipRevenuePct: vipBand ? roundTo(vipBand.revenueSharePct, 1) : 0,
		revenueAtRiskPct: roundTo(concentration.revenueAtRisk.revenueSharePct, 1),
	};
}
