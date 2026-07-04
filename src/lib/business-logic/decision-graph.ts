import type {
	BusinessSignal,
	DecisionGraphResult,
	RootCauseCluster,
	SignalOwner,
} from "@/types/business-signal";

/**
 * Decision Graph — merges many domain signals into a few root causes and ranks
 * them so a founder sees ONE problem instead of EIGHT metrics.
 *
 *   1. Cluster signals by shared related-entity tokens (union-find).
 *   2. Pick each cluster's root cause = the entity linking the most signals.
 *   3. Score = Σ impact (deduped) × avg-confidence × max-urgency, and rank.
 *
 * Pure — no I/O — so it is trivially testable and reused by the verify harness.
 */

/** Prefer more specific entity types when naming a root cause. */
const ENTITY_SPECIFICITY: Record<string, number> = {
	sku: 5,
	category: 4,
	store: 3,
	customer: 2,
	finance: 1,
};

function entityType(token: string): string {
	return token.split(":")[0] ?? "";
}

function humanizeEntity(token: string): string {
	const [type, ...rest] = token.split(":");
	const id = rest.join(":");
	const label = type ? type.charAt(0).toUpperCase() + type.slice(1) : token;
	return id ? `${label}: ${id}` : label;
}

/** Union-find over signals connected by shared entity tokens. */
class UnionFind {
	private parent: number[];
	constructor(n: number) {
		this.parent = Array.from({ length: n }, (_, i) => i);
	}
	find(x: number): number {
		let root = x;
		while (this.parent[root] !== root) root = this.parent[root];
		while (this.parent[x] !== root) {
			const next = this.parent[x];
			this.parent[x] = root;
			x = next;
		}
		return root;
	}
	union(a: number, b: number) {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.parent[rb] = ra;
	}
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

export function buildDecisionGraph(
	signals: BusinessSignal[],
): DecisionGraphResult {
	const n = signals.length;
	const uf = new UnionFind(n);

	// Link signals that share any related entity.
	const entityToSignals = new Map<string, number[]>();
	signals.forEach((sig, i) => {
		for (const e of sig.relatedEntities) {
			const list = entityToSignals.get(e) ?? [];
			list.push(i);
			entityToSignals.set(e, list);
		}
	});
	for (const idxs of entityToSignals.values()) {
		for (let k = 1; k < idxs.length; k++) uf.union(idxs[0], idxs[k]);
	}

	// Gather components.
	const components = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const root = uf.find(i);
		const list = components.get(root) ?? [];
		list.push(i);
		components.set(root, list);
	}

	const clusters: RootCauseCluster[] = [];
	for (const [root, idxs] of components) {
		const members = idxs.map((i) => signals[i]);

		// Root cause = entity present in the most member signals; tie-break by specificity.
		const entityCount = new Map<string, number>();
		for (const m of members) {
			for (const e of m.relatedEntities)
				entityCount.set(e, (entityCount.get(e) ?? 0) + 1);
		}
		let rootCause = members[0]?.relatedEntities[0] ?? `signal:${root}`;
		let best = -1;
		for (const [entity, count] of entityCount) {
			const spec = ENTITY_SPECIFICITY[entityType(entity)] ?? 0;
			const rank = count * 10 + spec;
			if (rank > best) {
				best = rank;
				rootCause = entity;
			}
		}

		const totalImpact = members.reduce(
			(s, m) => s + (Number.isFinite(m.impactAmount) ? m.impactAmount : 0),
			0,
		);
		const severity = Math.max(...members.map((m) => m.severity), 0);
		const urgency = Math.max(...members.map((m) => m.urgency), 0);
		const confidence =
			members.reduce((s, m) => s + m.confidence, 0) / members.length;
		// Impact × Confidence × Urgency (₹-scaled ranking).
		const score =
			totalImpact * clamp01(confidence / 100) * clamp01(urgency / 100);
		const owners = [...new Set(members.map((m) => m.owner))] as SignalOwner[];

		const ordered = members.slice().sort((a, b) => b.severity - a.severity);
		const title =
			members.length > 1
				? `${humanizeEntity(rootCause)} — ${members.length} linked issues`
				: ordered[0].title;

		clusters.push({
			id: `cluster-${root}`,
			rootCause,
			rootCauseLabel: humanizeEntity(rootCause),
			title,
			signals: ordered,
			totalImpact,
			severity,
			confidence: Math.round(confidence),
			urgency,
			score,
			owners,
		});
	}

	clusters.sort((a, b) => b.score - a.score || b.severity - a.severity);
	return { clusters, signalCount: n };
}
