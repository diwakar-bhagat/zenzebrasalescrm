import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sql } from "../lib/db";
import { ingestSalesLines } from "../lib/erp/ingest-sales";
import { normalizeOdooOrder } from "../lib/erp/normalize-odoo-order";
import { fetchOrderLines, POS_ORDER_FIELDS } from "../lib/erp/odoo-fetch";
import type { CanonicalSaleLine, OdooPosOrder } from "../lib/erp/types";
import { OdooClient } from "../lib/odoo-client";
import { publishRealtimeEvent } from "../lib/realtime/publisher";

/**
 * Odoo scheduled reconciliation and historical backfill.
 *
 * Two modes:
 *   backfill — pull everything from the beginning (or from `since`), once.
 *   delta    — pull `write_date >= last_sync` to recover anything the webhook missed.
 *
 * Mapping and writing are delegated to src/lib/erp, so a given order produces byte-identical
 * rows whether it arrived here or through the webhook. Previously this script carried its own
 * copy of the mapping and disagreed with the webhook on category, brand and discount handling.
 */

const SERVICE_NAME = "odoo_pos_sync";

async function ensureSyncCursorTable(): Promise<void> {
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
}

async function getLastSyncTimestamp(): Promise<string | null> {
	const rows = await sql`
		SELECT COALESCE(last_success_at, last_sync_at)::text AS ts
		FROM sync_cursors WHERE service_name = ${SERVICE_NAME} LIMIT 1
	`;
	return rows[0]?.ts ?? null;
}

async function markAttempt(): Promise<void> {
	await sql`
		INSERT INTO sync_cursors (service_name, last_sync_at, last_attempt_at, records_synced, status)
		VALUES (${SERVICE_NAME}, NOW(), NOW(), 0, 'running')
		ON CONFLICT (service_name) DO UPDATE SET last_attempt_at = NOW(), status = 'running'
	`;
}

async function markSuccess(recordsSynced: number): Promise<void> {
	await sql`
		UPDATE sync_cursors
		SET last_sync_at = NOW(), last_success_at = NOW(), records_synced = ${recordsSynced},
			status = 'success', last_error = NULL, consecutive_failures = 0
		WHERE service_name = ${SERVICE_NAME}
	`;
}

/**
 * Records a failure without advancing the cursor, so the next run re-covers the same window.
 * The previous implementation only ever wrote on success, so a failed sync was
 * indistinguishable from one that found nothing to do.
 */
async function markFailure(message: string): Promise<void> {
	await sql`
		UPDATE sync_cursors
		SET status = 'failed', last_error = ${message},
			consecutive_failures = consecutive_failures + 1
		WHERE service_name = ${SERVICE_NAME}
	`;
}

export interface OdooSyncOptions {
	mode?: "backfill" | "delta";
	batchSize?: number;
	/** ISO date to backfill from, e.g. "2026-07-18". Ignored in delta mode. */
	since?: string;
}

export async function runOdooSync(options: OdooSyncOptions = {}) {
	const mode = options.mode ?? "delta";
	const batchSize = options.batchSize ?? 200;

	console.log(`\n🚀 Odoo ingestion [${mode}]...`);

	await ensureSyncCursorTable();
	await markAttempt();

	try {
		const client = new OdooClient();
		const uid = await client.authenticate();
		console.log(`✅ Authenticated with Odoo (uid ${uid})`);

		const domain: unknown[] = [["state", "in", ["paid", "done", "invoiced"]]];

		if (mode === "delta") {
			const lastSync = await getLastSyncTimestamp();
			if (lastSync) {
				// Odoo compares against naive UTC strings; normalise the Postgres timestamp.
				const odooTs = new Date(lastSync)
					.toISOString()
					.replace("T", " ")
					.split(".")[0];
				domain.push(["write_date", ">=", odooTs]);
				console.log(`🔍 Delta filter: write_date >= '${odooTs}'`);
			} else {
				console.log("ℹ️  No cursor found; performing a full scan.");
			}
		} else if (options.since) {
			domain.push(["date_order", ">=", `${options.since} 00:00:00`]);
			console.log(`🔍 Backfill filter: date_order >= '${options.since}'`);
		}

		const totalCount = await client.searchCount("pos.order", domain);
		console.log(`📦 Matching Odoo POS orders: ${totalCount}`);

		if (totalCount === 0) {
			await markSuccess(0);
			console.log("✅ Nothing to sync.\n");
			return { success: true, processed: 0 };
		}

		let offset = 0;
		let totalUpserted = 0;
		const unresolved = new Set<string>();

		while (offset < totalCount) {
			// Order by id rather than date_order: pagination over a set filtered by write_date
			// is only stable on an immutable key, otherwise concurrent edits shift the window
			// and rows are skipped between pages.
			const orders = (await client.searchRead(
				"pos.order",
				domain,
				POS_ORDER_FIELDS,
				{
					limit: batchSize,
					offset,
					order: "id asc",
				},
			)) as OdooPosOrder[];

			if (orders.length === 0) break;

			const linesByOrder = await fetchOrderLines(client, orders);

			const rows: CanonicalSaleLine[] = [];
			for (const order of orders) {
				const orderId = Number(order.id);
				rows.push(
					...(await normalizeOdooOrder(order, linesByOrder.get(orderId) ?? [])),
				);
			}

			const result = await ingestSalesLines(rows, "odoo_sync");
			totalUpserted += result.upserted;
			for (const store of result.unresolvedStores) unresolved.add(store);

			offset += batchSize;
			console.log(
				`  └─ ${Math.min(offset, totalCount)} / ${totalCount} orders`,
			);
		}

		await markSuccess(totalUpserted);

		// A sale recovered by reconciliation is still new to anyone watching, so notify —
		// but only when something actually changed, otherwise every idle tick would wake
		// every dashboard for nothing.
		if (totalUpserted > 0) {
			await publishRealtimeEvent({
				name: "sync.completed",
				rows: totalUpserted,
				eventId: `sync-${Date.now()}`,
			});
		}

		if (unresolved.size > 0) {
			console.warn(
				`⚠️  Stores with no store_dimension match (rows ingested with a null store_id): ${[...unresolved].join(", ")}`,
			);
		}
		console.log(`\n🎉 Sync complete. Line items upserted: ${totalUpserted}\n`);
		return {
			success: true,
			processed: totalUpserted,
			unresolvedStores: [...unresolved],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await markFailure(message);
		throw error;
	}
}

if (require.main === module) {
	const args = process.argv.slice(2);
	const mode = args.includes("--backfill") ? "backfill" : "delta";
	const sinceArg = args.find((a) => a.startsWith("--since="));
	runOdooSync({ mode, since: sinceArg?.split("=")[1] })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("❌ Sync error:", err);
			process.exit(1);
		});
}
