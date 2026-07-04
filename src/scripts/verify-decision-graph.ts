import { buildDecisionGraph } from "../lib/business-logic/decision-graph";
import type { BusinessSignal } from "../types/business-signal";

/**
 * Decision Graph invariants — pure logic, no DB. Verifies that signals dedupe to
 * root causes correctly and ranking is well-formed. Part of the release gate.
 *
 *   npm run verify:decision-graph
 */

let failed = 0;
function assert(label: string, ok: boolean, detail = "") {
	console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `: ${detail}` : ""}`);
	if (!ok) failed++;
}

function sig(
	over: Partial<BusinessSignal> &
		Pick<BusinessSignal, "id" | "relatedEntities">,
): BusinessSignal {
	return {
		domain: "store",
		title: over.id,
		description: "",
		impactAmount: 0,
		severity: 50,
		confidence: 80,
		urgency: 50,
		owner: "Operations",
		evidence: [],
		suggestedActions: [],
		...over,
	} as BusinessSignal;
}

function main() {
	// Three signals sharing store:KLJ collapse into one cluster; an unrelated one stays separate.
	const signals: BusinessSignal[] = [
		sig({
			id: "store-klj",
			relatedEntities: ["store:KLJ"],
			impactAmount: 82000,
			severity: 91,
			urgency: 80,
		}),
		sig({
			id: "cat-bev",
			relatedEntities: ["store:KLJ", "category:BEVERAGES"],
			impactAmount: 30000,
			severity: 70,
			urgency: 60,
		}),
		sig({
			id: "sku-coldcoffee",
			relatedEntities: ["category:BEVERAGES", "sku:Cold Coffee"],
			impactAmount: 41000,
			severity: 96,
			urgency: 90,
		}),
		sig({
			id: "cust-anon",
			domain: "customer",
			relatedEntities: ["domain:customer"],
			impactAmount: 140000,
			severity: 65,
			urgency: 55,
			confidence: 95,
		}),
	];

	const graph = buildDecisionGraph(signals);

	assert(
		"signalCount preserved",
		graph.signalCount === 4,
		`${graph.signalCount}`,
	);
	assert(
		"linked signals collapse to root causes (KLJ+Beverages+ColdCoffee = 1 cluster)",
		graph.clusters.length === 2,
		`${graph.clusters.length} clusters`,
	);
	const big = graph.clusters.find((c) => c.signals.length === 3);
	assert(
		"root-cause cluster has 3 linked signals",
		Boolean(big),
		big ? big.rootCauseLabel : "not found",
	);
	assert(
		"cluster impact is deduped sum",
		big ? big.totalImpact === 82000 + 30000 + 41000 : false,
		big ? String(big.totalImpact) : "",
	);
	assert(
		"all scores finite and >= 0",
		graph.clusters.every((c) => Number.isFinite(c.score) && c.score >= 0),
		"",
	);
	assert(
		"clusters ranked by score descending",
		graph.clusters.every((c, i, a) => i === 0 || a[i - 1].score >= c.score),
		graph.clusters.map((c) => Math.round(c.score)).join(" >= "),
	);

	// Empty input is safe.
	const empty = buildDecisionGraph([]);
	assert(
		"empty signals → empty graph",
		empty.clusters.length === 0 && empty.signalCount === 0,
	);

	if (failed > 0) {
		console.error(`\n${failed} decision-graph check(s) failed.`);
		process.exit(1);
	}
	console.log("\n✅ Decision Graph invariants hold.");
}

main();
