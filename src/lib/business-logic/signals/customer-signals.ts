import type { BusinessSignal } from "@/types/business-signal";
import type {
	CustomerConcentrationResult,
	RevenueCompositionResult,
} from "@/types/customer-intelligence";

/**
 * Customer intelligence → BusinessSignal[]. Problem-oriented signals only
 * (things needing attention); positives stay on the customer page. Consumed by
 * the Decision Graph. Pure — derived from already-computed engine results.
 */
export interface CustomerSignalInputs {
	composition: RevenueCompositionResult;
	concentration: CustomerConcentrationResult;
	month1RetentionPct: number | null;
	/** Store scope, if the dashboard is filtered to one store (links to store signals). */
	store?: string;
}

export function getCustomerSignals(
	inputs: CustomerSignalInputs,
): BusinessSignal[] {
	const { composition, concentration, month1RetentionPct, store } = inputs;
	const signals: BusinessSignal[] = [];
	const scope = store
		? [`store:${store}`, "domain:customer"]
		: ["domain:customer"];

	const anon = composition.cards.find((c) => c.key === "anonymous");
	if (anon && anon.revenuePct >= 20) {
		signals.push({
			id: "cust-anonymous",
			domain: "customer",
			title: `${anon.revenuePct}% of revenue is from unknown customers`,
			description:
				"Capture mobile numbers at billing to unlock retention, LTV and targeting.",
			impactAmount: anon.revenue,
			severity: anon.revenuePct >= 40 ? 85 : 65,
			confidence: 95,
			urgency: anon.revenuePct >= 40 ? 75 : 55,
			owner: "Operations",
			evidence: [
				`Anonymous revenue ${anon.revenuePct}% (₹${Math.round(anon.revenue)})`,
			],
			suggestedActions: [
				{ label: "Enforce mobile capture at POS", owner: "Operations" },
			],
			relatedEntities: scope,
		});
	}

	if (month1RetentionPct !== null && month1RetentionPct < 30) {
		signals.push({
			id: "cust-retention",
			domain: "customer",
			title: `Month-1 retention is only ${month1RetentionPct}%`,
			description: "Most first-time buyers don't return the next month.",
			impactAmount: 0,
			severity: month1RetentionPct < 20 ? 80 : 60,
			confidence: 85,
			urgency: 60,
			owner: "Marketing",
			evidence: [`Month-1 retention ${month1RetentionPct}%`],
			suggestedActions: [
				{ label: "Launch a second-purchase nudge", owner: "Marketing" },
			],
			relatedEntities: scope,
		});
	}

	const risk = concentration.revenueAtRisk;
	if (risk.revenueSharePct >= 25 && risk.topCustomerCount > 0) {
		signals.push({
			id: "cust-revenue-at-risk",
			domain: "customer",
			title: `Top ${risk.topCustomerCount} customers drive ${risk.revenueSharePct}% of revenue`,
			description:
				"Heavy dependence on a few buyers — protect them proactively.",
			impactAmount: risk.revenue,
			severity: risk.revenueSharePct >= 40 ? 78 : 58,
			confidence: 90,
			urgency: 50,
			owner: "Marketing",
			evidence: [
				`${risk.revenueSharePct}% of revenue from top ${risk.topCustomerCount} customers`,
			],
			suggestedActions: [
				{ label: "VIP loyalty + proactive outreach", owner: "Marketing" },
			],
			relatedEntities: scope,
		});
	}

	const repeat = composition.cards.find((c) => c.key === "repeat");
	const fresh = composition.cards.find((c) => c.key === "new");
	if (
		repeat?.revenueGrowthPct != null &&
		fresh?.revenueGrowthPct != null &&
		repeat.revenueGrowthPct < 0 &&
		fresh.revenueGrowthPct > 0
	) {
		signals.push({
			id: "cust-leaky-bucket",
			domain: "customer",
			title: "Repeat revenue falling while new revenue rises",
			description: `Repeat ${repeat.revenueGrowthPct}%, new +${fresh.revenueGrowthPct}% — refilling a leaky bucket.`,
			impactAmount: Math.abs(
				repeat.revenue - repeat.revenue / (1 + repeat.revenueGrowthPct / 100),
			),
			severity: 72,
			confidence: 80,
			urgency: 65,
			owner: "Marketing",
			evidence: [
				`Repeat growth ${repeat.revenueGrowthPct}%`,
				`New growth +${fresh.revenueGrowthPct}%`,
			],
			suggestedActions: [
				{
					label: "Shift spend from acquisition to retention",
					owner: "Marketing",
				},
			],
			relatedEntities: scope,
		});
	}

	return signals;
}
