/**
 * Realtime channel naming.
 *
 * Namespaced rather than a single global channel, so a subscriber can take only what it needs:
 * a per-store view does not have to receive every other store's traffic, and adding a store or
 * a new event stream later does not require redesigning the layer.
 *
 * Channel names are also the unit of authorisation — the token endpoint grants `subscribe` on
 * the `dashboard:*` namespace only, never `publish`, so a browser can never inject an event.
 */

export const CHANNEL_NAMESPACE = "dashboard";

export const CHANNELS = {
	/** Every ingestion event, regardless of store. What the main dashboard listens on. */
	global: `${CHANNEL_NAMESPACE}:global`,
	/** Sales-only stream, for views that do not care about inventory or alerts. */
	sales: `${CHANNEL_NAMESPACE}:sales`,
	/** Per-store stream. `store` is the canonical billed_by value. */
	store: (store: string) => `${CHANNEL_NAMESPACE}:store:${slug(store)}`,
} as const;

/** Ably channel names must avoid whitespace and separators that collide with the namespace. */
export function slug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Wildcard used by the token endpoint to grant read access across the namespace. */
export const SUBSCRIBE_SCOPE = `${CHANNEL_NAMESPACE}:*`;

export type RealtimeEventName = "sale.ingested" | "sync.completed";

/**
 * Event payloads are deliberately thin.
 *
 * They are a *signal that data changed*, not the data itself. Every figure on the dashboard —
 * revenue, AOV, bill cuts, comparison periods — is computed in SQL under the active filters
 * (date range, store, category, categoryScope). A client that added a raw amount to a displayed
 * total would be wrong the moment the sale fell outside the current filter, and would drift
 * further with every event. Receivers refetch from PostgreSQL, which stays the source of truth.
 */
export interface RealtimeEvent {
	name: RealtimeEventName;
	/** Stable id for the delivery, so a duplicate can be discarded. */
	eventId: string;
	occurredAt: string;
	store?: string | null;
	/** Rows written. Useful for a toast ("3 new sales"), never for arithmetic. */
	rows?: number;
	billNo?: string | null;
}
