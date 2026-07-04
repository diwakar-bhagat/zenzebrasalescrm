import type { BusinessSignal, SignalOwner } from "@/types/business-signal";

import { type DiagnosisResult, diagnoseStore } from "../store-diagnosis";
import type { StorePerformanceRow } from "../store-performance";

/** Map the diagnosis owner enum to the shared SignalOwner vocabulary. */
const OWNER_MAP: Record<DiagnosisResult["owner"], SignalOwner> = {
	MARKETING: "Marketing",
	MERCHANDISING: "Merchandising",
	CATEGORY: "Category",
	OPERATIONS: "Operations",
	STORE_OPS: "Operations",
};

const SEVERITY_BY_PRIORITY: Record<DiagnosisResult["priority"], number> = {
	HIGH: 88,
	MEDIUM: 62,
	LOW: 35,
};

function growthNum(g: number | "NEW STORE"): number {
	return g === "NEW STORE" ? 0 : Number(g ?? 0);
}

/**
 * Store performance → BusinessSignal[]. Emits a signal for each store whose
 * revenue moved materially down, using the existing diagnosis engine for owner
 * and root cause (footfall / basket / mix). Entities link to `store:<billedBy>`
 * so future category/SKU/inventory signals collapse onto the same root cause.
 */
export function getStoreSignals(
	stores: StorePerformanceRow[],
): BusinessSignal[] {
	const signals: BusinessSignal[] = [];

	for (const s of stores) {
		const revGrowth = s.performance.revenue.growth;
		const billsGrowth = s.performance.billCuts.growth;
		const aovGrowth = s.performance.aov.growth;
		if (revGrowth === "NEW STORE") continue;

		const rev = growthNum(revGrowth);
		if (rev >= -5) continue; // only surface material declines

		const diag = diagnoseStore(revGrowth, billsGrowth, aovGrowth);
		const impact = Math.abs(
			s.performance.revenue.current - s.performance.revenue.previous,
		);

		signals.push({
			id: `store-${s.billedBy}`,
			domain: "store",
			title: `${s.name} revenue ${rev}%`,
			description: diag.message,
			impactAmount: impact,
			severity: SEVERITY_BY_PRIORITY[diag.priority],
			confidence: 90,
			urgency:
				diag.priority === "HIGH" ? 80 : diag.priority === "MEDIUM" ? 55 : 35,
			owner: OWNER_MAP[diag.owner],
			evidence: [
				`Revenue ${rev}% (₹${Math.round(s.performance.revenue.current)} vs ₹${Math.round(s.performance.revenue.previous)})`,
				`Bills ${growthNum(billsGrowth)}% · AOV ${growthNum(aovGrowth)}%`,
			],
			suggestedActions: [{ label: diag.message, owner: OWNER_MAP[diag.owner] }],
			relatedEntities: [`store:${s.billedBy}`],
		});
	}

	return signals;
}
