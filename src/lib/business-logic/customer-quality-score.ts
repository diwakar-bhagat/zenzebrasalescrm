import type {
	QualityBand,
	RetentionCohortResult,
	RevenueQualityScore,
	ScoreFactor,
	ScoreReason,
} from "@/types/customer-intelligence";

import { roundTo, safeDiv } from "./safe-math";

/**
 * Tunable scoring constants. Weights sum to 1. Anchors document the intent so
 * founders can recalibrate as benchmarks emerge — none are magic thresholds.
 */
const WEIGHTS = {
	repeatMix: 0.3, // repeat revenue share
	retention: 0.25, // month-1 cohort retention
	identity: 0.2, // low anonymous revenue = high identity quality
	loyaltyDepth: 0.15, // LTV / AOV (how many repeat baskets)
	basket: 0.1, // AOV strength
} as const;

/** AOV curve anchor: basket score = 100·(1 − e^(−aov/ANCHOR)). ₹800 ≈ 63. */
const AOV_ANCHOR = 800;
/** LTV/AOV ratio that earns a full loyalty-depth score. */
const LOYALTY_TARGET_RATIO = 3;

function clamp100(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(100, n));
}

/** Month number (year*12 + month) from an ISO date/month string. */
function monthNum(iso: string): number {
	const [y, m] = iso.split("-");
	return Number(y) * 12 + (Number(m) - 1);
}

/**
 * Headline month-1 retention: weighted across every cohort old enough to have a
 * following month within the data window. Cohorts with no month-1 activity count
 * as churned (0), not excluded — so retention is honest. Returns null if no
 * cohort is eligible yet. Shared with the insight engine.
 */
export function headlineMonth1Retention(
	cohort: RetentionCohortResult,
	endIso: string,
): number | null {
	const endMonth = monthNum(endIso.slice(0, 7));
	let retained = 0;
	let base = 0;
	for (const row of cohort.cohorts) {
		if (monthNum(row.cohortMonth) >= endMonth) continue; // too new for a month-1
		base += row.cohortSize;
		const cell = row.cells.find((c) => c.monthOffset === 1);
		retained += cell ? cell.activeCustomers : 0;
	}
	if (base === 0) return null;
	return roundTo(safeDiv(retained, base) * 100, 1);
}

export interface QualityScoreInputs {
	repeatRevenuePct: number;
	newRevenuePct: number;
	anonymousRevenuePct: number;
	month1RetentionPct: number | null;
	aov: number;
	ltv: number;
}

function bandFor(score: number): QualityBand {
	if (score >= 80) return "Excellent";
	if (score >= 65) return "Healthy";
	if (score >= 45) return "Watch";
	return "Weak";
}

function starsFor(score: number): number {
	if (score >= 80) return 5;
	if (score >= 65) return 4;
	if (score >= 45) return 3;
	if (score >= 25) return 2;
	return 1;
}

const HEADLINE: Record<QualityBand, string> = {
	Excellent: "Business is customer-driven — loyal customers compound growth.",
	Healthy: "Solid customer base with room to deepen loyalty.",
	Watch: "Growth leans on new acquisition — retention needs attention.",
	Weak: "Growth depends on constant acquisition — retention is fragile.",
};

/**
 * Revenue Quality Score (0–100) powering the Customer Health card. Blends repeat
 * revenue mix, retention, identity quality, loyalty depth, and basket strength.
 * Pure function — no I/O — so it is trivially testable and reused by the script.
 */
export function computeRevenueQualityScore(
	inputs: QualityScoreInputs,
): RevenueQualityScore {
	const ratio = safeDiv(inputs.ltv, inputs.aov, 1);

	const factors: ScoreFactor[] = [
		{
			key: "repeatMix",
			label: "Repeat revenue mix",
			value: inputs.repeatRevenuePct,
			score: clamp100(inputs.repeatRevenuePct),
			weight: WEIGHTS.repeatMix,
			note: "Share of revenue from returning customers.",
		},
		{
			key: "retention",
			label: "Month-1 retention",
			value: inputs.month1RetentionPct,
			score: clamp100(inputs.month1RetentionPct ?? 0),
			weight: WEIGHTS.retention,
			note: "Customers who return the month after acquisition.",
		},
		{
			key: "identity",
			label: "Identity quality",
			value: roundTo(100 - inputs.anonymousRevenuePct, 1),
			score: clamp100(100 - inputs.anonymousRevenuePct),
			weight: WEIGHTS.identity,
			note: "Lower anonymous revenue = better customer knowledge.",
		},
		{
			key: "loyaltyDepth",
			label: "Loyalty depth (LTV/AOV)",
			value: roundTo(ratio, 2),
			score: clamp100(safeDiv(ratio - 1, LOYALTY_TARGET_RATIO - 1) * 100),
			weight: WEIGHTS.loyaltyDepth,
			note: "How many baskets an average customer buys over their life.",
		},
		{
			key: "basket",
			label: "Basket strength (AOV)",
			value: inputs.aov,
			score: clamp100(100 * (1 - Math.exp(-safeDiv(inputs.aov, AOV_ANCHOR)))),
			weight: WEIGHTS.basket,
			note: "Average spend per bill.",
		},
	];

	const score = roundTo(
		factors.reduce((sum, f) => sum + f.score * f.weight, 0),
		0,
	);
	const band = bandFor(score);

	return {
		score,
		band,
		stars: starsFor(score),
		headline: HEADLINE[band],
		factors,
		reasons: buildReasons(inputs, ratio),
		metrics: {
			repeatRevenuePct: inputs.repeatRevenuePct,
			newRevenuePct: inputs.newRevenuePct,
			month1RetentionPct: inputs.month1RetentionPct,
			anonymousRevenuePct: inputs.anonymousRevenuePct,
			aov: inputs.aov,
			ltv: inputs.ltv,
		},
	};
}

/**
 * Explainability — the drivers behind the score, so a founder never sees a
 * black-box number. Positives (+) and drags (−) with the underlying metric.
 */
function buildReasons(
	inputs: QualityScoreInputs,
	ratio: number,
): ScoreReason[] {
	const reasons: ScoreReason[] = [];
	const r = (sign: "+" | "−", text: string) => reasons.push({ sign, text });

	if (inputs.repeatRevenuePct >= 45)
		r("+", `Repeat revenue strong (${inputs.repeatRevenuePct}%)`);
	else if (inputs.repeatRevenuePct < 30)
		r("−", `Repeat revenue low (${inputs.repeatRevenuePct}%)`);

	if (inputs.month1RetentionPct !== null) {
		if (inputs.month1RetentionPct >= 40)
			r("+", `Month-1 retention healthy (${inputs.month1RetentionPct}%)`);
		else if (inputs.month1RetentionPct < 30)
			r("−", `Month-1 retention weak (${inputs.month1RetentionPct}%)`);
	}

	if (inputs.anonymousRevenuePct <= 15)
		r("+", "Most revenue is from known customers");
	else if (inputs.anonymousRevenuePct >= 25)
		r("−", `Anonymous revenue high (${inputs.anonymousRevenuePct}%)`);

	if (ratio >= 2)
		r("+", `Customers buy repeatedly (LTV ${ratio.toFixed(1)}× AOV)`);
	else if (ratio < 1.5) r("−", "Shallow loyalty — most customers buy once");

	if (inputs.aov >= 400)
		r("+", `Solid basket size (₹${Math.round(inputs.aov)} AOV)`);
	else if (inputs.aov < 150)
		r("−", `Low basket size (₹${Math.round(inputs.aov)} AOV)`);

	return reasons;
}
