import { type NextRequest, NextResponse } from "next/server";
import { runOdooSync } from "@/scripts/odoo-backfill-sync";

/**
 * POST /api/admin/odoo-sync
 *
 * Periodic Reconciliation & Delta Sync Endpoint.
 * Invoked by Vercel Cron or Admin trigger to perform `write_date >= last_sync` delta synchronization.
 *
 * Query Params / Body:
 * - mode: "delta" (default) | "backfill"
 * - secret: optional admin secret matching ODOO_WEBHOOK_SECRET
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	const secret = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
	if (process.env.ODOO_WEBHOOK_SECRET && secret !== process.env.ODOO_WEBHOOK_SECRET) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let mode: "delta" | "backfill" = "delta";
	try {
		const body = await req.json();
		if (body.mode === "backfill" || body.mode === "delta") {
			mode = body.mode;
		}
	} catch {
		// Use default "delta"
	}

	try {
		const result = await runOdooSync({ mode });
		return NextResponse.json({ mode, ...result });
	} catch (error) {
		console.error("[api/admin/odoo-sync] Error during Odoo sync:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Sync failed" },
			{ status: 500 }
		);
	}
}

export async function GET(req: NextRequest) {
	return POST(req);
}
