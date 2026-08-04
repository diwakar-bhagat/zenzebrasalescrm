import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Reconciles two overlapping telemetry migrations that were applied to the same database.
 *
 * migrate-webhook-events-table.ts created webhook_events and added sales_fact.source /
 * sync_type / webhook_event_id. migrate-erp-sync-telemetry.ts added sales_fact.source_system /
 * ingested_at / source_event_at and extended sync_cursors. Both ran, leaving two parallel
 * provenance systems.
 *
 * This migration keeps ONE of each:
 *   - webhook_events keeps its live shape and gains the columns the health engine needs.
 *   - sales_fact.source_system wins; source / sync_type are dropped.
 *
 * Why source_system wins: `source` and `sync_type` were added with DEFAULT 'WEBHOOK' /
 * 'REALTIME', so PostgreSQL stamped those defaults onto all 25,696 pre-existing rows. Every
 * Excel row imported since Sep 2025 claims to have arrived by real-time webhook. source_system
 * was backfilled explicitly from upload_batches before its default was applied, so its
 * excel/odoo_sync split is accurate.
 *
 * Idempotent. Safe to re-run.
 */

async function migrate() {
	if (!process.env.DATABASE_URL) {
		console.error("Missing DATABASE_URL in environment.");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("Connected. Reconciling ERP telemetry schema...\n");

	try {
		// ── 1. webhook_events: add what the health engine needs ──────────────────
		// The live table came from migrate-webhook-events-table.ts (received_at, processed_at,
		// latency_ms, status, error, model, record_id, payload). These four columns are what
		// distinguish "a delivery happened" from "a delivery produced correct data".
		console.log("[1/4] Extending webhook_events...");
		await sql`
			ALTER TABLE webhook_events
				ADD COLUMN IF NOT EXISTS endpoint        TEXT,
				ADD COLUMN IF NOT EXISTS rows_upserted   INTEGER NOT NULL DEFAULT 0,
				ADD COLUMN IF NOT EXISTS source_event_at TIMESTAMPTZ,
				ADD COLUMN IF NOT EXISTS store_name      TEXT
		`;
		await sql`UPDATE webhook_events SET endpoint = '/api/webhooks/odoo' WHERE endpoint IS NULL`;

		// status was VARCHAR(50) holding RECEIVED/PROCESSED/FAILED. The handler also needs to
		// record deliveries it rejected before processing, which had no representation at all.
		await sql`
			CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received
				ON webhook_events (status, received_at DESC)
		`;

		const eventCols = await sql`
			SELECT column_name FROM information_schema.columns
			WHERE table_name = 'webhook_events' ORDER BY ordinal_position
		`;
		console.log(
			"      webhook_events columns:",
			eventCols.map((c) => c.column_name).join(", "),
		);

		// ── 2. Reconcile provenance before dropping anything ─────────────────────
		// Rows written by the webhook route carry webhook_event_id but were never given a
		// source_system (the column has DEFAULT 'excel'), so they are currently mislabelled.
		console.log("[2/4] Correcting source_system for webhook-ingested rows...");
		const corrected = await sql`
			UPDATE sales_fact
			SET source_system = 'odoo_webhook'
			WHERE webhook_event_id IS NOT NULL AND source_system <> 'odoo_webhook'
			RETURNING id
		`;
		console.log(`      Relabelled ${corrected.length} row(s) as odoo_webhook.`);

		const before = await sql`
			SELECT source_system, COUNT(*)::int AS rows FROM sales_fact GROUP BY 1 ORDER BY 2 DESC
		`;
		console.log("      Provenance after correction:", before);

		// ── 3. Drop the corrupted duplicate columns ──────────────────────────────
		console.log("[3/4] Dropping corrupted source / sync_type columns...");
		await sql`ALTER TABLE sales_fact DROP COLUMN IF EXISTS source`;
		await sql`ALTER TABLE sales_fact DROP COLUMN IF EXISTS sync_type`;
		console.log(
			"      Dropped. source_system is now the single provenance column.",
		);
		// webhook_event_id is kept: it is a useful FK from a fact row back to the delivery
		// that produced it, and unlike source/sync_type it was never given a bogus default.

		// ── 4. Unify the sync cursor service name ────────────────────────────────
		// The scheduled sync writes 'odoo_pos_sync' while the webhook route wrote
		// 'odoo_pos_sales', so cron health and webhook health lived in different rows and
		// neither view saw the other. Consolidate onto the name the sync script uses.
		console.log("[4/4] Consolidating sync_cursors rows...");
		await sql`
			UPDATE sync_cursors target
			SET last_webhook_at = source.last_webhook_at,
				last_webhook_latency_ms = source.last_webhook_latency_ms,
				last_webhook_status = source.last_webhook_status
			FROM sync_cursors source
			WHERE target.service_name = 'odoo_pos_sync'
				AND source.service_name = 'odoo_pos_sales'
				AND source.last_webhook_at IS NOT NULL
				AND (target.last_webhook_at IS NULL OR source.last_webhook_at > target.last_webhook_at)
		`;
		await sql`DELETE FROM sync_cursors WHERE service_name = 'odoo_pos_sales'`;

		const cursors = await sql`SELECT * FROM sync_cursors`;
		console.log("      sync_cursors:", cursors);

		console.log("\n✅ ERP telemetry reconciliation completed successfully.");
	} catch (error) {
		console.error("\n❌ Reconciliation failed:", error);
		process.exit(1);
	}
}

migrate();
