import path from "node:path";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Operational hardening for the ingestion pipeline.
 *
 *   1. webhook_events gains `environment` and `origin` so noise can be *classified* rather
 *      than deleted. Deleting rows destroys the answer to "why did sync fail on 4 August?"
 *      months later, which is exactly when the question gets asked.
 *
 *   2. sync_locks prevents two reconciliation runs from overlapping.
 *
 * Why a lock table and not pg_advisory_lock: PostgreSQL advisory locks are held for the
 * lifetime of a *session*, and Neon's HTTP driver opens a new connection per query. The lock
 * would be released the instant the acquiring statement returned, protecting nothing. A row
 * with an expiry survives across connections and, unlike a bare boolean flag, self-heals if a
 * run dies without releasing it.
 *
 * Idempotent.
 */

async function migrate() {
	if (!process.env.DATABASE_URL) {
		console.error("Missing DATABASE_URL in environment.");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("Connected. Adding audit classification and sync locks...\n");

	try {
		// ── 1. Classify events instead of deleting them ──────────────────────────
		console.log("[1/3] Extending webhook_events with audit classification...");
		await sql`
			ALTER TABLE webhook_events
				ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production',
				ADD COLUMN IF NOT EXISTS origin      TEXT NOT NULL DEFAULT 'webhook'
		`;
		await sql`
			CREATE INDEX IF NOT EXISTS idx_webhook_events_env_origin
				ON webhook_events (environment, origin, received_at DESC)
		`;
		console.log("      environment: production | preview | development | test");
		console.log("      origin     : webhook | reconciliation | manual");

		// ── 2. Overlap lock for the reconciliation pull ──────────────────────────
		console.log("[2/3] Creating sync_locks...");
		await sql`
			CREATE TABLE IF NOT EXISTS sync_locks (
				name       TEXT PRIMARY KEY,
				holder     TEXT NOT NULL,
				locked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				expires_at TIMESTAMPTZ NOT NULL
			)
		`;

		// ── 3. Report ────────────────────────────────────────────────────────────
		console.log("[3/3] Current state:");
		console.table(
			await sql`
				SELECT environment, origin, status, COUNT(*)::int AS events
				FROM webhook_events GROUP BY 1,2,3 ORDER BY 4 DESC
			`,
		);
		console.table(await sql`SELECT * FROM sync_locks`);

		console.log("\n✅ Audit classification and sync locks ready.");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	}
}

migrate();
