/**
 * BusinessSignal — the standardized contract every intelligence engine emits.
 *
 * Engines produce signals, not UI. The Decision Graph consumes ONLY
 * `BusinessSignal[]`, so new domains (inventory, finance, …) can be added later
 * without touching the prioritization logic.
 *
 * Convention for cross-domain root-cause clustering: `relatedEntities` uses
 * `"<type>:<id>"` tokens (e.g. `"store:Klj store"`, `"category:BEVERAGES"`,
 * `"sku:Cold Coffee"`). Signals that share an entity are linked into one cause.
 */

export type SignalDomain =
	| "customer"
	| "store"
	| "inventory"
	| "sku"
	| "finance"
	| "category";

export type SignalOwner =
	| "Marketing"
	| "Inventory"
	| "Category"
	| "Finance"
	| "Operations"
	| "Merchandising"
	| "Founder";

export interface SignalAction {
	label: string;
	owner?: SignalOwner;
}

export interface BusinessSignal {
	id: string;
	domain: SignalDomain;
	title: string;
	description: string;
	/** Rupees at stake (0 when not quantifiable). */
	impactAmount: number;
	/** 0–100, higher = worse problem. */
	severity: number;
	/** 0–100, certainty given data completeness. */
	confidence: number;
	/** 0–100, how time-sensitive the action is. */
	urgency: number;
	owner: SignalOwner;
	evidence: string[];
	suggestedActions: SignalAction[];
	/** "<type>:<id>" tokens used to link signals sharing a root cause. */
	relatedEntities: string[];
}

/** A cluster of signals that share a root cause. */
export interface RootCauseCluster {
	id: string;
	/** The entity token most responsible for the cluster (e.g. "sku:Cold Coffee"). */
	rootCause: string;
	/** Human-readable root-cause label. */
	rootCauseLabel: string;
	title: string;
	signals: BusinessSignal[];
	/** Deduplicated ₹ impact across the cluster. */
	totalImpact: number;
	severity: number;
	confidence: number;
	urgency: number;
	/** Ranking score = impact × confidence × urgency (₹-scaled). */
	score: number;
	owners: SignalOwner[];
}

export interface DecisionGraphResult {
	clusters: RootCauseCluster[];
	/** Count of raw signals fed in (for reconciliation). */
	signalCount: number;
}
