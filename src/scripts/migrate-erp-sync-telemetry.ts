import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * ERP Sync Telemetry Migration — Phase 2 (Odoo becomes primary source of truth).
 *
 * Adds the provenance and timing substrate the dashboard needs to report sync health honestly:
 *   1. sales_fact.source_system / ingested_at / source_event_at  → reflection time is computable
 *   2. webhook_events                                            → inbound deliveries become visible
 *   3. sync_cursors error columns                                → failed pulls stop being silent
 *
 * Idempotent. Safe to re-run.
 */

async function migrate() {
	if (!process.env.DATABASE_URL) {
		console.error("Missing DATABASE_URL in environment.");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);
	console.log("Connected. Beginning ERP sync telemetry migration...\n");

	try {
		// ── 1. sales_fact provenance + timing ────────────────────────────────────
		console.log("[1/5] Adding provenance columns to sales_fact...");
		await sql`
			ALTER TABLE sales_fact
				ADD COLUMN IF NOT EXISTS source_system   TEXT,
				ADD COLUMN IF NOT EXISTS ingested_at     TIMESTAMPTZ,
				ADD COLUMN IF NOT EXISTS source_event_at TIMESTAMPTZ
		`;

		// Backfill provenance from the batch that produced each row, before enforcing NOT NULL.
		// 'Odoo Enterprise SaaS Pipeline' batches were written by the delta/backfill sync.
		console.log("      Backfilling source_system from upload_batches...");
		await sql`
			UPDATE sales_fact sf
			SET source_system = CASE
					WHEN ub.filename = 'Odoo Enterprise SaaS Pipeline' THEN 'odoo_sync'
					ELSE 'excel'
				END
			FROM upload_batches ub
			WHERE sf.upload_id = ub.id AND sf.source_system IS NULL
		`;
		// Rows whose upload_id points at no batch (e.g. the dangling upload_id = 0 written by
		// the legacy /sales webhook route) still need a value.
		await sql`UPDATE sales_fact SET source_system = 'excel' WHERE source_system IS NULL`;

		console.log("      Backfilling ingested_at from upload_batches.uploaded_at...");
		await sql`
			UPDATE sales_fact sf
			SET ingested_at = ub.uploaded_at
			FROM upload_batches ub
			WHERE sf.upload_id = ub.id AND sf.ingested_at IS NULL AND ub.uploaded_at IS NOT NULL
		`;
		// Fall back to the sale date itself so the column is never null.
		await sql`
			UPDATE sales_fact
			SET ingested_at = sale_date::timestamptz
			WHERE ingested_at IS NULL
		`;

		await sql`
			ALTER TABLE sales_fact
				ALTER COLUMN source_system SET NOT NULL,
				ALTER COLUMN source_system SET DEFAULT 'excel',
				ALTER COLUMN ingested_at   SET NOT NULL,
				ALTER COLUMN ingested_at   SET DEFAULT NOW()
		`;

		await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_ingested_at ON sales_fact (ingested_at DESC)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_sales_fact_source_system ON sales_fact (source_system)`;

		const provenance = await sql`
			SELECT source_system, COUNT(*)::int AS rows, MIN(sale_date) AS min_date, MAX(sale_date) AS max_date
			FROM sales_fact GROUP BY 1 ORDER BY 2 DESC
		`;
		console.log("      Provenance distribution:", provenance);

		// ── 2. sales_fact_v — append the new columns ─────────────────────────────
		// IMPORTANT: use CREATE OR REPLACE, never DROP ... CASCADE. The materialized view
		// mv_customer_identity depends on this view and CASCADE would silently destroy it.
		// CREATE OR REPLACE permits appending columns at the end only, so the existing column
		// list and order below must stay byte-identical to the current definition.
		console.log("[2/5] Extending sales_fact_v with provenance columns...");
		await sql`
			CREATE OR REPLACE VIEW sales_fact_v AS
			SELECT
				sf.id,
				sf.upload_id,
				sf.bill_no,
				sf.sale_date,
				sf.billed_by,
				sf.product_key,
				sf.sku_code,
				sf.item_name,
				sf.brand,
				sf.category,
				sf.quantity,
				sf.mrp_amount,
				sf.discount_amount,
				sf.gross_amount,
				sf.tax_amount,
				sf.net_amount,
				sf.customer_mobile,
				sf.customer_name,
				sf.payment_method,
				sf.source_billed_by,
				sf.store_id,
				COALESCE(sd.display_name, sf.billed_by) AS store_display_name,
				sf.source_system,
				sf.ingested_at,
				sf.source_event_at
			FROM sales_fact sf
			LEFT JOIN store_dimension sd ON sf.store_id = sd.id
		`;

		// ── 3. webhook_events ────────────────────────────────────────────────────
		console.log("[3/5] Creating webhook_events...");
		await sql`
			CREATE TABLE IF NOT EXISTS webhook_events (
				id              BIGSERIAL PRIMARY KEY,
				received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				endpoint        TEXT NOT NULL,
				source          TEXT NOT NULL DEFAULT 'odoo',
				odoo_model      TEXT,
				odoo_record_id  INTEGER,
				payload         JSONB,
				status          TEXT NOT NULL,
				error_message   TEXT,
				rows_upserted   INTEGER NOT NULL DEFAULT 0,
				source_event_at TIMESTAMPTZ,
				processing_ms   INTEGER,
				store_name      TEXT
			)
		`;
		await sql`CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events (received_at DESC)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events (status, received_at DESC)`;

		// ── 4. sync_cursors error tracking ───────────────────────────────────────
		// The table is created inline by odoo-backfill-sync.ts; ensure it exists before altering.
		console.log("[4/5] Extending sync_cursors with failure tracking...");
		await sql`
			CREATE TABLE IF NOT EXISTS sync_cursors (
				service_name   VARCHAR(100) PRIMARY KEY,
				last_sync_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				records_synced INTEGER NOT NULL DEFAULT 0,
				status         VARCHAR(50) NOT NULL DEFAULT 'success'
			)
		`;
		await sql`
			ALTER TABLE sync_cursors
				ADD COLUMN IF NOT EXISTS last_attempt_at      TIMESTAMPTZ,
				ADD COLUMN IF NOT EXISTS last_success_at      TIMESTAMPTZ,
				ADD COLUMN IF NOT EXISTS last_error           TEXT,
				ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0
		`;
		// Existing single row only ever recorded successes, so seed both timestamps from it.
		await sql`
			UPDATE sync_cursors
			SET last_success_at = COALESCE(last_success_at, last_sync_at),
				last_attempt_at = COALESCE(last_attempt_at, last_sync_at)
			WHERE last_success_at IS NULL OR last_attempt_at IS NULL
		`;

		// ── 5. Retire the upload-centric data_freshness view ─────────────────────
		// Replaced by the sync-health engine. Its INNER JOIN on upload_batches also silently
		// dropped any sales_fact row with a dangling upload_id from its totals.
		console.log("[5/5] Dropping obsolete data_freshness view...");
		await sql`DROP VIEW IF EXISTS data_freshness`;

		console.log("\n✅ ERP sync telemetry migration completed successfully.");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	}
}

migrate();
