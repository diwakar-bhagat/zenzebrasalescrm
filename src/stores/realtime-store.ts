import { create } from "zustand";
import type { RealtimeEvent } from "@/lib/realtime/channels";

/**
 * Realtime refresh signal.
 *
 * Dashboard pages fetch inside `useEffect` with a dependency array. Adding `revision` to that
 * array is all it takes for a page to reload itself when new sales arrive — no page needs to
 * know Ably exists, and the existing fetch-and-compute-in-SQL flow is untouched.
 *
 * `revision` is a counter rather than the event payload on purpose: every figure on the
 * dashboard is computed server-side under the active filters, so the client must refetch, not
 * do arithmetic on an incoming amount. See lib/realtime/channels.ts.
 */

export type RealtimeStatus =
	| "disabled"
	| "connecting"
	| "connected"
	| "disconnected";

interface RealtimeState {
	/** Increments once per accepted event. Use in useEffect deps to trigger a refetch. */
	revision: number;
	status: RealtimeStatus;
	lastEvent: RealtimeEvent | null;
	lastEventAt: string | null;
	setStatus: (status: RealtimeStatus) => void;
	applyEvent: (event: RealtimeEvent) => void;
}

/**
 * Ably guarantees at-least-once delivery, and Odoo re-sends an order on every edit, so the same
 * event id can legitimately arrive twice. Remembering recent ids keeps one sale from triggering
 * several refetches.
 */
const seen = new Set<string>();
const SEEN_LIMIT = 500;

export const useRealtimeStore = create<RealtimeState>((set) => ({
	revision: 0,
	status: "connecting",
	lastEvent: null,
	lastEventAt: null,

	setStatus: (status) => set({ status }),

	applyEvent: (event) => {
		if (event.eventId) {
			if (seen.has(event.eventId)) return;
			seen.add(event.eventId);
			// Bounded FIFO: insertion order is guaranteed for Set, so the oldest goes first.
			if (seen.size > SEEN_LIMIT)
				seen.delete(seen.values().next().value as string);
		}

		set((state) => ({
			revision: state.revision + 1,
			lastEvent: event,
			lastEventAt: new Date().toISOString(),
		}));
	},
}));

/**
 * Returns a value that changes whenever fresh data is available.
 *
 * Usage — add it to the dependency array of an existing fetch effect:
 *
 *   const revision = useRealtimeRevision();
 *   useEffect(() => { fetchDashboard(); }, [startDate, endDate, store, revision]);
 */
export function useRealtimeRevision(): number {
	return useRealtimeStore((s) => s.revision);
}
