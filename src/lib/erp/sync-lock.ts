import { randomUUID } from "node:crypto";
import { sql } from "../db";

/**
 * Cross-invocation lock for the reconciliation pull.
 *
 * At a one-minute cadence a slow run can still be working when the next tick fires. Two
 * concurrent syncs would contend on the same upsert keys, double the Odoo API traffic and
 * interleave their cursor writes — the second finishing first would advance the cursor past
 * records the first had not yet written, so those sales would never be fetched again.
 *
 * Not pg_advisory_lock: those are held for the lifetime of a session, and Neon's HTTP driver
 * uses a fresh connection per query, so the lock would be released the moment the acquiring
 * statement returned. A row with an expiry survives across connections.
 *
 * The expiry is what makes this safe rather than a footgun: a run killed mid-flight (a Vercel
 * timeout, a crash) leaves the row behind, and without a TTL that would wedge reconciliation
 * permanently. The lease simply lapses instead.
 */

/** Slightly above the 60s function ceiling on Vercel Hobby, so a timed-out run cannot wedge it. */
const DEFAULT_TTL_SECONDS = 90;

export interface SyncLock {
	name: string;
	holder: string;
	release: () => Promise<void>;
}

/**
 * Attempts to take the named lock.
 *
 * Returns null when another run holds it — the caller should exit quietly, not retry: the
 * holder is already covering this window, and the next tick will pick up anything new.
 *
 * Acquisition is a single statement, so two callers racing cannot both succeed: the WHERE on
 * the conflict path only matches an expired lease, and PostgreSQL serialises the conflicting
 * inserts on the primary key.
 */
export async function acquireSyncLock(
	name: string,
	ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<SyncLock | null> {
	const holder = `${process.env.VERCEL_REGION ?? "local"}-${randomUUID()}`;

	try {
		const rows = await sql`
			INSERT INTO sync_locks (name, holder, locked_at, expires_at)
			VALUES (${name}, ${holder}, NOW(), NOW() + (${ttlSeconds} * INTERVAL '1 second'))
			ON CONFLICT (name) DO UPDATE
				SET holder = EXCLUDED.holder,
					locked_at = EXCLUDED.locked_at,
					expires_at = EXCLUDED.expires_at
				WHERE sync_locks.expires_at < NOW()
			RETURNING holder
		`;

		// No row returned means the conflict path's WHERE failed: a live lease is held.
		if (rows.length === 0 || rows[0]?.holder !== holder) return null;

		return {
			name,
			holder,
			release: () => releaseSyncLock(name, holder),
		};
	} catch (error) {
		// Never block ingestion on lock bookkeeping. Failing open risks an overlap; failing
		// closed would stop reconciliation entirely, which is the worse outcome.
		console.error(
			"[sync-lock] failed to acquire, proceeding without lock:",
			error,
		);
		return { name, holder, release: async () => {} };
	}
}

/** Releases only if still held by this holder, so a lapsed run cannot free someone else's lease. */
async function releaseSyncLock(name: string, holder: string): Promise<void> {
	try {
		await sql`DELETE FROM sync_locks WHERE name = ${name} AND holder = ${holder}`;
	} catch (error) {
		console.error("[sync-lock] failed to release (lease will expire):", error);
	}
}
