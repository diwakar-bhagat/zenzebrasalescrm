import Ably from "ably";
import {
	CHANNELS,
	type RealtimeEvent,
	type RealtimeEventName,
} from "./channels";

/**
 * Server-side realtime publisher.
 *
 * Publishing is strictly a notification that PostgreSQL changed. It happens *after* a
 * successful commit, never before: a subscriber that refetched on an event published ahead of
 * the write would read stale rows and then never be told again.
 *
 * Realtime is best-effort by design. A failed publish is logged and swallowed — losing a
 * notification costs a few seconds of latency until the next event or the reconciliation pull,
 * whereas failing the webhook over it would cost the sale itself.
 */

let client: Ably.Rest | null = null;
let warned = false;

/** The API key never leaves the server; browsers authenticate with short-lived tokens. */
function getClient(): Ably.Rest | null {
	const key = process.env.ABLY_API_KEY;

	if (!key) {
		if (!warned) {
			console.info(
				"[realtime] ABLY_API_KEY not set — realtime publishing disabled. Ingestion is unaffected; dashboards fall back to their normal refresh.",
			);
			warned = true;
		}
		return null;
	}

	if (!client) client = new Ably.Rest({ key });
	return client;
}

/** True when realtime is configured. Surfaced in sync health so the UI can say so honestly. */
export function isRealtimeConfigured(): boolean {
	return Boolean(process.env.ABLY_API_KEY);
}

export interface PublishInput {
	name: RealtimeEventName;
	store?: string | null;
	rows?: number;
	billNo?: string | null;
	/** Stable identity for the source event, so redeliveries carry the same id. */
	eventId?: string | number | null;
}

/**
 * Publishes one event to the global stream, the sales stream, and the store's own channel.
 *
 * Fan-out happens here rather than in the client so subscribers never need to know the naming
 * scheme, and so a per-store view can subscribe to exactly one channel.
 */
export async function publishRealtimeEvent(input: PublishInput): Promise<void> {
	const ably = getClient();
	if (!ably) return;

	const event: RealtimeEvent = {
		name: input.name,
		// Carried through to the client, which discards a repeat. Odoo re-delivers on every
		// edit of an order, so the same sale legitimately arrives more than once.
		eventId: String(
			input.eventId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		),
		occurredAt: new Date().toISOString(),
		store: input.store ?? null,
		rows: input.rows,
		billNo: input.billNo ?? null,
	};

	const targets: string[] = [CHANNELS.global, CHANNELS.sales];
	if (input.store) targets.push(CHANNELS.store(input.store));

	try {
		await Promise.all(
			targets.map((name) => ably.channels.get(name).publish(event.name, event)),
		);
	} catch (error) {
		console.error("[realtime] publish failed (ingestion unaffected):", error);
	}
}
